//! Installer orchestration subsystem.
//!
//! This module provides the main installer entry point that composes:
//! - Architecture selection
//! - Managed-root derivation
//! - Discovery
//! - Lock acquisition
//! - Transaction recovery
//! - Bounded download
//! - Digest verification
//! - PE and identity verification
//! - Transactional promotion
//! - Cleanup
//! - Stable redacted errors

pub mod architecture;
pub mod discovery;
pub mod download;
pub mod error;
pub mod lock;
pub mod managed_root;
pub mod recovery;
pub mod transaction;
pub mod verification;

pub use architecture::SupportedArch;
pub use discovery::{discover_explicit, discover_managed, DiscoveredExecutable, SourceClassification};
pub use download::{download_file, DownloadConfig, DownloadedFile};
pub use error::{InstallError, InstallErrorCode};
pub use lock::{acquire_lock, InstallLock};
pub use managed_root::{managed_executable_path, production_managed_root};
pub use recovery::{recover, RecoveryAction, RecoveryState};
pub use transaction::{TransactionManager, TransactionState};
pub use verification::{verify_with_handle, VerifiedArtifact};

use crate::jcode::auth::{bounded, redact};
use std::path::{Path, PathBuf};

/// Pinned artifact metadata from M1 authority.
#[derive(Debug, Clone)]
pub struct PinnedArtifact {
    /// Version string.
    pub version: String,
    /// Architecture.
    pub arch: SupportedArch,
    /// Expected file size in bytes.
    pub size: u64,
    /// Expected SHA-256 digest (hex string).
    pub sha256: String,
    /// Filename.
    pub filename: String,
}

impl PinnedArtifact {
    /// Create a pinned artifact for a specific architecture.
    pub fn for_arch(arch: SupportedArch) -> Result<Self, InstallError> {
        // Use M1 authority tables
        use crate::jcode::verification::{EXPECTED_ASSETS_V0_81_7, PINNED_JCODE_VERSION};

        let (filename, size, sha256) = match arch {
            SupportedArch::X86_64 => {
                // Find x86_64 asset in M1 table
                for (name, size, sha256) in EXPECTED_ASSETS_V0_81_7 {
                    if name.contains("x86_64") || name.contains("x64") {
                        return Ok(Self {
                            version: PINNED_JCODE_VERSION.to_string(),
                            arch,
                            size: *size,
                            sha256: sha256.to_string(),
                            filename: name.to_string(),
                        });
                    }
                }
                return Err(InstallError::new(
                    InstallErrorCode::DiscoveryFailed,
                    "x86_64 artifact not found in M1 table".to_string(),
                ));
            }
            SupportedArch::AArch64 => {
                // Find ARM64 asset in M1 table
                for (name, size, sha256) in EXPECTED_ASSETS_V0_81_7 {
                    if name.contains("arm64") || name.contains("aarch64") {
                        return Ok(Self {
                            version: PINNED_JCODE_VERSION.to_string(),
                            arch,
                            size: *size,
                            sha256: sha256.to_string(),
                            filename: name.to_string(),
                        });
                    }
                }
                return Err(InstallError::new(
                    InstallErrorCode::DiscoveryFailed,
                    "ARM64 artifact not found in M1 table".to_string(),
                ));
            }
        };
    }

    /// Get the download URL for this artifact.
    pub fn download_url(&self) -> String {
        use crate::jcode::verification::PINNED_JCODE_VERSION;
        format!(
            "https://github.com/1jehuang/jcode/releases/download/v{}/{}",
            PINNED_JCODE_VERSION, self.filename
        )
    }
}

/// Main installer orchestrator.
#[derive(Debug)]
pub struct Installer {
    /// Managed root directory.
    managed_root: PathBuf,
    /// Host architecture.
    arch: SupportedArch,
}

impl Installer {
    /// Create a new installer.
    pub fn new() -> Result<Self, InstallError> {
        let managed_root = production_managed_root()?;
        let arch = SupportedArch::host()?;

        Ok(Self { managed_root, arch })
    }

    /// Get the managed root directory.
    pub fn managed_root(&self) -> &Path {
        &self.managed_root
    }

    /// Get the host architecture.
    pub fn arch(&self) -> SupportedArch {
        self.arch
    }

    /// Ensure the executable is installed and verified.
    ///
    /// This is the main entry point that orchestrates the entire installation:
    /// 1. Acquire installation lock
    /// 2. Check for existing valid installation
    /// 3. Recover from interrupted transactions
    /// 4. Download if needed
    /// 5. Verify with protective handle
    /// 6. Promote transactionally
    /// 7. Return verified artifact
    pub fn ensure_installed(&self) -> Result<VerifiedArtifact, InstallError> {
        let artifact = PinnedArtifact::for_arch(self.arch)?;

        // Acquire installation lock
        let _lock = acquire_lock(&artifact.version, None)?;

        // Construct destination path
        let dest_path = managed_executable_path(
            &self.managed_root,
            &artifact.version,
            self.arch.archive_name(),
            &artifact.filename,
        );

        // Create transaction manager
        let metadata_dir = self.managed_root.join(".transaction");
        let mut tx_manager = TransactionManager::new(metadata_dir)?;

        // Check if destination is valid
        let destination_valid = if dest_path.exists() {
            // Try to validate existing file
            verify_with_handle(
                &dest_path,
                self.arch,
                &artifact.sha256,
                artifact.size,
            )
            .is_ok()
        } else {
            false
        };

        // Recover from any interrupted transactions
        let recovery_action = recover(&mut tx_manager, &dest_path, destination_valid)?;

        match recovery_action {
            RecoveryAction::AlreadyInstalled => {
                // Already installed and verified
                return verify_with_handle(
                    &dest_path,
                    self.arch,
                    &artifact.sha256,
                    artifact.size,
                );
            }
            RecoveryAction::CleanInstall
            | RecoveryAction::Rollback
            | RecoveryAction::RemoveAndReinstall => {
                // Proceed with installation
            }
            RecoveryAction::CompleteCleanup => {
                // Transaction was complete, verify and return
                return verify_with_handle(
                    &dest_path,
                    self.arch,
                    &artifact.sha256,
                    artifact.size,
                );
            }
            RecoveryAction::ManualIntervention(msg) => {
                return Err(InstallError::new(
                    InstallErrorCode::RecoveryFailed,
                    msg,
                ));
            }
        }

        // Create staging directory
        let staging_dir = self.managed_root.join(".staging");
        std::fs::create_dir_all(&staging_dir).map_err(|e| {
            InstallError::with_path(
                InstallErrorCode::StagingFailed,
                format!("Failed to create staging directory: {}", e),
                &staging_dir,
            )
        })?;

        // Download artifact
        let download_config = DownloadConfig {
            url: artifact.download_url(),
            expected_size: artifact.size,
            staging_dir: staging_dir.clone(),
            filename: artifact.filename.clone(),
        };

        let downloaded = download_file(&download_config)?;

        // Verify downloaded file
        let _verified = verify_with_handle(
            &downloaded.path,
            self.arch,
            &artifact.sha256,
            artifact.size,
        )?;

        // Begin transaction
        tx_manager.begin(downloaded.path.clone(), dest_path.clone())?;

        // Backup destination if it exists
        tx_manager.backup()?;

        // Promote atomically
        tx_manager.promote()?;

        // Complete transaction
        tx_manager.complete()?;

        // Clean up staging directory
        if staging_dir.exists() {
            let _ = std::fs::remove_dir_all(&staging_dir);
        }

        // Return verified artifact with protective handle
        verify_with_handle(
            &dest_path,
            self.arch,
            &artifact.sha256,
            artifact.size,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pinned_artifact_table_is_complete() {
        let x86 = PinnedArtifact::for_arch(SupportedArch::X86_64).unwrap();
        assert!(!x86.version.is_empty());
        assert!(x86.size > 0);
        assert!(!x86.sha256.is_empty());
        assert!(!x86.filename.is_empty());

        let arm = PinnedArtifact::for_arch(SupportedArch::AArch64).unwrap();
        assert!(!arm.version.is_empty());
        assert!(arm.size > 0);
        assert!(!arm.sha256.is_empty());
        assert!(!arm.filename.is_empty());
    }

    #[test]
    fn download_url_is_version_scoped() {
        let artifact = PinnedArtifact::for_arch(SupportedArch::X86_64).unwrap();
        let url = artifact.download_url();
        assert!(url.starts_with("https://github.com/"));
        assert!(url.contains("/releases/download/"));
        assert!(url.contains(&artifact.version));
    }

    #[cfg(windows)]
    #[test]
    fn installer_creation() {
        let installer = Installer::new().unwrap();
        assert!(installer.managed_root().to_string_lossy().contains("CodingStudio"));
    }
}
