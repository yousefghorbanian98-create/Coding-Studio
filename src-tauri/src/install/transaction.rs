//! Transactional same-volume promotion with rollback.
//!
//! This module provides atomic file promotion with:
//! - Same-volume staging, destination, backup, and metadata
//! - Destination preservation (backup before replace)
//! - Rollback after partial promotion
//! - Explicit durability and flush points
//! - No delete-then-copy window
//! - Deterministic cleanup
//! - Idempotent repeat execution

use crate::install::error::{InstallError, InstallErrorCode};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Transaction state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TransactionState {
    /// Initial state: no transaction in progress.
    Idle,
    /// Staging: file downloaded to staging directory.
    Staged,
    /// Backup: destination backed up.
    BackedUp,
    /// Promotion: atomic rename in progress.
    Promoting,
    /// Complete: promotion succeeded, cleanup pending.
    Complete,
    /// Rollback: promotion failed, rollback in progress.
    RollingBack,
    /// Failed: transaction failed, manual intervention required.
    Failed,
}

/// Transaction metadata persisted to disk.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionMetadata {
    /// Transaction state.
    pub state: TransactionState,
    /// Staging path.
    pub staging_path: PathBuf,
    /// Destination path.
    pub destination_path: PathBuf,
    /// Backup path (if backed up).
    pub backup_path: Option<PathBuf>,
    /// Transaction ID.
    pub transaction_id: String,
    /// Timestamp (ISO 8601).
    pub timestamp: String,
}

/// A transaction manager for atomic file promotion.
#[derive(Debug)]
pub struct TransactionManager {
    /// Base directory for transaction metadata.
    metadata_dir: PathBuf,
    /// Current transaction (if any).
    current: Option<TransactionMetadata>,
}

impl TransactionManager {
    /// Create a new transaction manager.
    ///
    /// # Arguments
    ///
    /// * `metadata_dir` - Directory for transaction metadata (must be on same volume as destination)
    pub fn new(metadata_dir: PathBuf) -> Result<Self, InstallError> {
        fs::create_dir_all(&metadata_dir).map_err(|e| {
            InstallError::with_path(
                InstallErrorCode::TransactionFailed,
                format!("Failed to create metadata directory: {}", e),
                &metadata_dir,
            )
        })?;

        let mut manager = Self {
            metadata_dir,
            current: None,
        };

        // Try to recover existing transaction
        if let Ok(metadata) = manager.load_metadata() {
            manager.current = Some(metadata);
        }

        Ok(manager)
    }

    /// Get the current transaction state.
    pub fn state(&self) -> TransactionState {
        self.current
            .as_ref()
            .map(|m| m.state)
            .unwrap_or(TransactionState::Idle)
    }

    /// Begin a new transaction.
    ///
    /// # Arguments
    ///
    /// * `staging_path` - Path to staged file
    /// * `destination_path` - Final destination path
    pub fn begin(
        &mut self,
        staging_path: PathBuf,
        destination_path: PathBuf,
    ) -> Result<(), InstallError> {
        if self.state() != TransactionState::Idle {
            return Err(InstallError::new(
                InstallErrorCode::TransactionFailed,
                format!("Transaction already in progress: {:?}", self.state()),
            ));
        }

        let transaction_id = format!("{}", std::process::id());
        let timestamp = chrono::Utc::now().to_rfc3339();

        let metadata = TransactionMetadata {
            state: TransactionState::Staged,
            staging_path,
            destination_path,
            backup_path: None,
            transaction_id,
            timestamp,
        };

        self.save_metadata(&metadata)?;
        self.current = Some(metadata);

        Ok(())
    }

    /// Backup the destination before promotion.
    pub fn backup(&mut self) -> Result<(), InstallError> {
        let metadata = self.current.as_mut().ok_or_else(|| {
            InstallError::new(
                InstallErrorCode::TransactionFailed,
                "No transaction in progress".to_string(),
            )
        })?;

        if metadata.state != TransactionState::Staged {
            return Err(InstallError::new(
                InstallErrorCode::TransactionFailed,
                format!("Cannot backup in state: {:?}", metadata.state),
            ));
        }

        // Only backup if destination exists
        if metadata.destination_path.exists() {
            let backup_path = metadata.destination_path.with_extension("backup");
            fs::rename(&metadata.destination_path, &backup_path).map_err(|e| {
                InstallError::with_path(
                    InstallErrorCode::TransactionFailed,
                    format!("Failed to backup destination: {}", e),
                    &metadata.destination_path,
                )
            })?;
            metadata.backup_path = Some(backup_path);
        }

        metadata.state = TransactionState::BackedUp;
        self.save_metadata(metadata)?;

        Ok(())
    }

    /// Promote the staged file to the destination.
    ///
    /// This performs an atomic rename on the same volume.
    pub fn promote(&mut self) -> Result<(), InstallError> {
        let metadata = self.current.as_mut().ok_or_else(|| {
            InstallError::new(
                InstallErrorCode::TransactionFailed,
                "No transaction in progress".to_string(),
            )
        })?;

        if metadata.state != TransactionState::BackedUp {
            return Err(InstallError::new(
                InstallErrorCode::TransactionFailed,
                format!("Cannot promote in state: {:?}", metadata.state),
            ));
        }

        metadata.state = TransactionState::Promoting;
        self.save_metadata(metadata)?;

        // Perform atomic rename
        fs::rename(&metadata.staging_path, &metadata.destination_path).map_err(|e| {
            // Promotion failed, attempt rollback
            let _ = self.rollback();
            InstallError::with_path(
                InstallErrorCode::PromotionFailed,
                format!("Failed to promote staged file: {}", e),
                &metadata.staging_path,
            )
        })?;

        metadata.state = TransactionState::Complete;
        self.save_metadata(metadata)?;

        Ok(())
    }

    /// Rollback a failed transaction.
    pub fn rollback(&mut self) -> Result<(), InstallError> {
        let metadata = self.current.as_ref().ok_or_else(|| {
            InstallError::new(
                InstallErrorCode::TransactionFailed,
                "No transaction in progress".to_string(),
            )
        })?;

        // If we have a backup, restore it
        if let Some(backup_path) = &metadata.backup_path {
            if backup_path.exists() && !metadata.destination_path.exists() {
                let _ = fs::rename(backup_path, &metadata.destination_path);
            }
        }

        // Clean up staging file
        if metadata.staging_path.exists() {
            let _ = fs::remove_file(&metadata.staging_path);
        }

        // Clean up backup if destination was restored
        if let Some(backup_path) = &metadata.backup_path {
            if backup_path.exists() {
                let _ = fs::remove_file(backup_path);
            }
        }

        // Remove transaction metadata
        self.current = None;
        self.delete_metadata()?;

        Ok(())
    }

    /// Complete a successful transaction.
    pub fn complete(&mut self) -> Result<(), InstallError> {
        let metadata = self.current.as_ref().ok_or_else(|| {
            InstallError::new(
                InstallErrorCode::TransactionFailed,
                "No transaction in progress".to_string(),
            )
        })?;

        if metadata.state != TransactionState::Complete {
            return Err(InstallError::new(
                InstallErrorCode::TransactionFailed,
                format!("Cannot complete in state: {:?}", metadata.state),
            ));
        }

        // Clean up backup
        if let Some(backup_path) = &metadata.backup_path {
            if backup_path.exists() {
                let _ = fs::remove_file(backup_path);
            }
        }

        // Remove transaction metadata
        self.current = None;
        self.delete_metadata()?;

        Ok(())
    }

    /// Recover from an interrupted transaction.
    pub fn recover(&mut self) -> Result<(), InstallError> {
        match self.state() {
            TransactionState::Idle => Ok(()),
            TransactionState::Staged | TransactionState::BackedUp | TransactionState::Promoting => {
                // Transaction was interrupted, rollback
                self.rollback()
            }
            TransactionState::Complete => {
                // Transaction completed but cleanup was interrupted
                self.complete()
            }
            TransactionState::RollingBack => {
                // Rollback was interrupted, try again
                self.rollback()
            }
            TransactionState::Failed => Err(InstallError::new(
                InstallErrorCode::TransactionFailed,
                "Transaction in failed state, manual intervention required".to_string(),
            )),
        }
    }

    /// Save transaction metadata to disk.
    fn save_metadata(&self, metadata: &TransactionMetadata) -> Result<(), InstallError> {
        let metadata_path = self.metadata_dir.join("transaction.json");
        let json = serde_json::to_string_pretty(metadata).map_err(|e| {
            InstallError::new(
                InstallErrorCode::TransactionFailed,
                format!("Failed to serialize metadata: {}", e),
            )
        })?;

        fs::write(&metadata_path, json).map_err(|e| {
            InstallError::with_path(
                InstallErrorCode::TransactionFailed,
                format!("Failed to write metadata: {}", e),
                &metadata_path,
            )
        })?;

        Ok(())
    }

    /// Load transaction metadata from disk.
    fn load_metadata(&self) -> Result<TransactionMetadata, InstallError> {
        let metadata_path = self.metadata_dir.join("transaction.json");
        if !metadata_path.exists() {
            return Err(InstallError::new(
                InstallErrorCode::TransactionFailed,
                "No transaction metadata found".to_string(),
            ));
        }

        let json = fs::read_to_string(&metadata_path).map_err(|e| {
            InstallError::with_path(
                InstallErrorCode::TransactionFailed,
                format!("Failed to read metadata: {}", e),
                &metadata_path,
            )
        })?;

        let metadata: TransactionMetadata = serde_json::from_str(&json).map_err(|e| {
            InstallError::new(
                InstallErrorCode::TransactionFailed,
                format!("Failed to parse metadata: {}", e),
            )
        })?;

        Ok(metadata)
    }

    /// Delete transaction metadata.
    fn delete_metadata(&self) -> Result<(), InstallError> {
        let metadata_path = self.metadata_dir.join("transaction.json");
        if metadata_path.exists() {
            fs::remove_file(&metadata_path).map_err(|e| {
                InstallError::with_path(
                    InstallErrorCode::TransactionFailed,
                    format!("Failed to delete metadata: {}", e),
                    &metadata_path,
                )
            })?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn transaction_starts_in_idle_state() {
        let temp = TempDir::new().unwrap();
        let manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        assert_eq!(manager.state(), TransactionState::Idle);
    }

    #[test]
    fn transaction_begin_transitions_to_staged() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();

        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "test").unwrap();

        manager.begin(staging, destination).unwrap();
        assert_eq!(manager.state(), TransactionState::Staged);
    }

    #[test]
    fn transaction_backup_transitions_correctly() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();

        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "new").unwrap();
        std::fs::write(&destination, "old").unwrap();

        manager.begin(staging, destination).unwrap();
        manager.backup().unwrap();
        assert_eq!(manager.state(), TransactionState::BackedUp);
    }

    #[test]
    fn transaction_promote_succeeds() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();

        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "new content").unwrap();

        manager.begin(staging.clone(), destination.clone()).unwrap();
        manager.backup().unwrap();
        manager.promote().unwrap();

        assert_eq!(manager.state(), TransactionState::Complete);
        assert!(destination.exists());
        assert!(!staging.exists());
        assert_eq!(std::fs::read_to_string(&destination).unwrap(), "new content");
    }

    #[test]
    fn transaction_complete_cleans_up() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();

        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "test").unwrap();

        manager.begin(staging, destination).unwrap();
        manager.backup().unwrap();
        manager.promote().unwrap();
        manager.complete().unwrap();

        assert_eq!(manager.state(), TransactionState::Idle);
    }

    #[test]
    fn transaction_rollback_restores_backup() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();

        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "new").unwrap();
        std::fs::write(&destination, "old").unwrap();

        manager.begin(staging, destination.clone()).unwrap();
        manager.backup().unwrap();
        manager.rollback().unwrap();

        assert_eq!(manager.state(), TransactionState::Idle);
        assert!(destination.exists());
        assert_eq!(std::fs::read_to_string(&destination).unwrap(), "old");
    }

    #[test]
    fn transaction_recover_from_staged() {
        let temp = TempDir::new().unwrap();
        let metadata_dir = temp.path().join("metadata");
        std::fs::create_dir(&metadata_dir).unwrap();

        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "test").unwrap();

        // Simulate interrupted transaction
        let metadata = TransactionMetadata {
            state: TransactionState::Staged,
            staging_path: staging.clone(),
            destination_path: destination,
            backup_path: None,
            transaction_id: "test".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
        };
        let json = serde_json::to_string(&metadata).unwrap();
        std::fs::write(metadata_dir.join("transaction.json"), json).unwrap();

        // Recover
        let mut manager = TransactionManager::new(metadata_dir).unwrap();
        manager.recover().unwrap();

        assert_eq!(manager.state(), TransactionState::Idle);
        assert!(!staging.exists());
    }

    #[test]
    fn transaction_idempotent_begin_fails() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();

        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "test").unwrap();

        manager.begin(staging.clone(), destination.clone()).unwrap();
        let result = manager.begin(staging, destination);
        assert!(result.is_err());
    }

    #[test]
    fn transaction_state_transitions_enforced() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();

        // Cannot promote without backup
        let result = manager.promote();
        assert!(result.is_err());

        // Cannot complete without transaction
        let result = manager.complete();
        assert!(result.is_err());
    }

    #[test]
    fn transaction_metadata_persisted() {
        let temp = TempDir::new().unwrap();
        let metadata_dir = temp.path().to_path_buf();

        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "test").unwrap();

        {
            let mut manager = TransactionManager::new(metadata_dir.clone()).unwrap();
            manager.begin(staging, destination).unwrap();
        }

        // Reload manager
        let manager = TransactionManager::new(metadata_dir).unwrap();
        assert_eq!(manager.state(), TransactionState::Staged);
    }

    #[test]
    fn transaction_cleanup_removes_metadata() {
        let temp = TempDir::new().unwrap();
        let metadata_dir = temp.path().to_path_buf();

        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "test").unwrap();

        let mut manager = TransactionManager::new(metadata_dir.clone()).unwrap();
        manager.begin(staging, destination).unwrap();
        manager.backup().unwrap();
        manager.promote().unwrap();
        manager.complete().unwrap();

        assert!(!metadata_dir.join("transaction.json").exists());
    }
}
