//! Interruption recovery with states A through H.
//!
//! This module implements recovery from interrupted installations:
//! - State A: No transaction, no destination → clean install
//! - State B: Transaction staged, no destination → rollback staging
//! - State C: Transaction backed up, no destination → rollback backup
//! - State D: Transaction promoting → rollback or complete
//! - State E: Transaction complete, destination exists → cleanup
//! - State F: No transaction, destination exists, valid → already installed
//! - State G: No transaction, destination exists, invalid → remove and reinstall
//! - State H: Transaction failed → manual intervention

use crate::install::error::{InstallError, InstallErrorCode};
use crate::install::transaction::{TransactionManager, TransactionState};
use std::path::Path;

/// Recovery state classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RecoveryState {
    /// State A: No transaction, no destination → clean install.
    CleanInstall,
    /// State B: Transaction staged, no destination → rollback staging.
    StagedNoDestination,
    /// State C: Transaction backed up, no destination → rollback backup.
    BackedUpNoDestination,
    /// State D: Transaction promoting → rollback or complete.
    Promoting,
    /// State E: Transaction complete, destination exists → cleanup.
    CompleteWithDestination,
    /// State F: No transaction, destination exists, valid → already installed.
    AlreadyInstalled,
    /// State G: No transaction, destination exists, invalid → remove and reinstall.
    InvalidDestination,
    /// State H: Transaction failed → manual intervention.
    Failed,
}

/// Recovery action to take.
#[derive(Debug, Clone)]
pub enum RecoveryAction {
    /// Proceed with clean installation.
    CleanInstall,
    /// Rollback transaction and clean up.
    Rollback,
    /// Complete transaction cleanup.
    CompleteCleanup,
    /// No action needed, already installed.
    AlreadyInstalled,
    /// Remove invalid destination and reinstall.
    RemoveAndReinstall,
    /// Manual intervention required.
    ManualIntervention(String),
}

/// Classify the current state into a recovery state.
///
/// # Arguments
///
/// * `transaction_manager` - Transaction manager with current state
/// * `destination_path` - Path to the destination executable
/// * `destination_valid` - Whether the destination is valid (if it exists)
pub fn classify_recovery_state(
    transaction_manager: &TransactionManager,
    destination_path: &Path,
    destination_valid: bool,
) -> RecoveryState {
    let tx_state = transaction_manager.state();
    let destination_exists = destination_path.exists();

    match (tx_state, destination_exists, destination_valid) {
        // State A: No transaction, no destination
        (TransactionState::Idle, false, _) => RecoveryState::CleanInstall,

        // State B: Transaction staged, no destination
        (TransactionState::Staged, false, _) => RecoveryState::StagedNoDestination,

        // State C: Transaction backed up, no destination
        (TransactionState::BackedUp, false, _) => RecoveryState::BackedUpNoDestination,

        // State D: Transaction promoting
        (TransactionState::Promoting, _, _) => RecoveryState::Promoting,

        // State E: Transaction complete, destination exists
        (TransactionState::Complete, true, _) => RecoveryState::CompleteWithDestination,

        // State F: No transaction, destination exists, valid
        (TransactionState::Idle, true, true) => RecoveryState::AlreadyInstalled,

        // State G: No transaction, destination exists, invalid
        (TransactionState::Idle, true, false) => RecoveryState::InvalidDestination,

        // State H: Transaction failed
        (TransactionState::Failed, _, _) => RecoveryState::Failed,

        // State H: Transaction rolling back (interrupted rollback)
        (TransactionState::RollingBack, _, _) => RecoveryState::Failed,

        // Edge cases: treat as failed
        _ => RecoveryState::Failed,
    }
}

/// Determine the recovery action for a given state.
pub fn determine_recovery_action(state: RecoveryState) -> RecoveryAction {
    match state {
        RecoveryState::CleanInstall => RecoveryAction::CleanInstall,
        RecoveryState::StagedNoDestination => RecoveryAction::Rollback,
        RecoveryState::BackedUpNoDestination => RecoveryAction::Rollback,
        RecoveryState::Promoting => RecoveryAction::Rollback,
        RecoveryState::CompleteWithDestination => RecoveryAction::CompleteCleanup,
        RecoveryState::AlreadyInstalled => RecoveryAction::AlreadyInstalled,
        RecoveryState::InvalidDestination => RecoveryAction::RemoveAndReinstall,
        RecoveryState::Failed => RecoveryAction::ManualIntervention(
            "Transaction in failed state. Manual cleanup required.".to_string(),
        ),
    }
}

/// Execute recovery for a given state.
///
/// # Arguments
///
/// * `transaction_manager` - Transaction manager
/// * `destination_path` - Path to destination executable
/// * `state` - Recovery state
pub fn execute_recovery(
    transaction_manager: &mut TransactionManager,
    destination_path: &Path,
    state: RecoveryState,
) -> Result<RecoveryAction, InstallError> {
    let action = determine_recovery_action(state);

    match action {
        RecoveryAction::CleanInstall => {
            // No action needed, proceed with installation
            Ok(RecoveryAction::CleanInstall)
        }
        RecoveryAction::Rollback => {
            // Rollback transaction
            transaction_manager.rollback()?;
            Ok(RecoveryAction::Rollback)
        }
        RecoveryAction::CompleteCleanup => {
            // Complete transaction cleanup
            transaction_manager.complete()?;
            Ok(RecoveryAction::CompleteCleanup)
        }
        RecoveryAction::AlreadyInstalled => {
            // No action needed
            Ok(RecoveryAction::AlreadyInstalled)
        }
        RecoveryAction::RemoveAndReinstall => {
            // Remove invalid destination
            if destination_path.exists() {
                std::fs::remove_file(destination_path).map_err(|e| {
                    InstallError::with_path(
                        InstallErrorCode::RecoveryFailed,
                        format!("Failed to remove invalid destination: {}", e),
                        destination_path,
                    )
                })?;
            }
            Ok(RecoveryAction::RemoveAndReinstall)
        }
        RecoveryAction::ManualIntervention(ref msg) => {
            Err(InstallError::new(InstallErrorCode::RecoveryFailed, msg.clone()))
        }
    }
}

/// Perform full recovery cycle.
///
/// This function:
/// 1. Classifies the current state
/// 2. Determines the recovery action
/// 3. Executes the recovery
/// 4. Returns the final action taken
pub fn recover(
    transaction_manager: &mut TransactionManager,
    destination_path: &Path,
    destination_valid: bool,
) -> Result<RecoveryAction, InstallError> {
    let state = classify_recovery_state(transaction_manager, destination_path, destination_valid);
    execute_recovery(transaction_manager, destination_path, state)
}

/// Check if recovery is idempotent (can be run multiple times safely).
pub fn is_recovery_idempotent(state: RecoveryState) -> bool {
    match state {
        RecoveryState::CleanInstall => true,
        RecoveryState::StagedNoDestination => true,
        RecoveryState::BackedUpNoDestination => true,
        RecoveryState::Promoting => true,
        RecoveryState::CompleteWithDestination => true,
        RecoveryState::AlreadyInstalled => true,
        RecoveryState::InvalidDestination => true,
        RecoveryState::Failed => false, // Requires manual intervention
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn classify_state_a_clean_install() {
        let temp = TempDir::new().unwrap();
        let manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let destination = temp.path().join("dest.exe");

        let state = classify_recovery_state(&manager, &destination, false);
        assert_eq!(state, RecoveryState::CleanInstall);
    }

    #[test]
    fn classify_state_f_already_installed() {
        let temp = TempDir::new().unwrap();
        let manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let destination = temp.path().join("dest.exe");
        std::fs::write(&destination, "test").unwrap();

        let state = classify_recovery_state(&manager, &destination, true);
        assert_eq!(state, RecoveryState::AlreadyInstalled);
    }

    #[test]
    fn classify_state_g_invalid_destination() {
        let temp = TempDir::new().unwrap();
        let manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let destination = temp.path().join("dest.exe");
        std::fs::write(&destination, "invalid").unwrap();

        let state = classify_recovery_state(&manager, &destination, false);
        assert_eq!(state, RecoveryState::InvalidDestination);
    }

    #[test]
    fn classify_state_b_staged_no_destination() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "test").unwrap();

        manager.begin(staging, destination.clone()).unwrap();

        let state = classify_recovery_state(&manager, &destination, false);
        assert_eq!(state, RecoveryState::StagedNoDestination);
    }

    #[test]
    fn recovery_action_clean_install() {
        let action = determine_recovery_action(RecoveryState::CleanInstall);
        assert!(matches!(action, RecoveryAction::CleanInstall));
    }

    #[test]
    fn recovery_action_rollback() {
        let action = determine_recovery_action(RecoveryState::StagedNoDestination);
        assert!(matches!(action, RecoveryAction::Rollback));
    }

    #[test]
    fn recovery_action_already_installed() {
        let action = determine_recovery_action(RecoveryState::AlreadyInstalled);
        assert!(matches!(action, RecoveryAction::AlreadyInstalled));
    }

    #[test]
    fn recovery_action_remove_and_reinstall() {
        let action = determine_recovery_action(RecoveryState::InvalidDestination);
        assert!(matches!(action, RecoveryAction::RemoveAndReinstall));
    }

    #[test]
    fn recovery_action_manual_intervention() {
        let action = determine_recovery_action(RecoveryState::Failed);
        assert!(matches!(action, RecoveryAction::ManualIntervention(_)));
    }

    #[test]
    fn execute_recovery_clean_install() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let destination = temp.path().join("dest.exe");

        let result = execute_recovery(&mut manager, &destination, RecoveryState::CleanInstall);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), RecoveryAction::CleanInstall));
    }

    #[test]
    fn execute_recovery_rollback() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let staging = temp.path().join("staged.exe");
        let destination = temp.path().join("dest.exe");
        std::fs::write(&staging, "test").unwrap();

        manager.begin(staging, destination.clone()).unwrap();

        let result =
            execute_recovery(&mut manager, &destination, RecoveryState::StagedNoDestination);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), RecoveryAction::Rollback));
        assert_eq!(manager.state(), TransactionState::Idle);
    }

    #[test]
    fn execute_recovery_remove_and_reinstall() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let destination = temp.path().join("dest.exe");
        std::fs::write(&destination, "invalid").unwrap();

        let result =
            execute_recovery(&mut manager, &destination, RecoveryState::InvalidDestination);
        assert!(result.is_ok());
        assert!(matches!(
            result.unwrap(),
            RecoveryAction::RemoveAndReinstall
        ));
        assert!(!destination.exists());
    }

    #[test]
    fn execute_recovery_manual_intervention_fails() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let destination = temp.path().join("dest.exe");

        let result = execute_recovery(&mut manager, &destination, RecoveryState::Failed);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::RecoveryFailed);
    }

    #[test]
    fn recover_full_cycle_clean_install() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let destination = temp.path().join("dest.exe");

        let result = recover(&mut manager, &destination, false);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), RecoveryAction::CleanInstall));
    }

    #[test]
    fn recover_full_cycle_already_installed() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let destination = temp.path().join("dest.exe");
        std::fs::write(&destination, "valid").unwrap();

        let result = recover(&mut manager, &destination, true);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), RecoveryAction::AlreadyInstalled));
    }

    #[test]
    fn recovery_idempotent_for_clean_states() {
        assert!(is_recovery_idempotent(RecoveryState::CleanInstall));
        assert!(is_recovery_idempotent(RecoveryState::AlreadyInstalled));
        assert!(is_recovery_idempotent(RecoveryState::StagedNoDestination));
    }

    #[test]
    fn recovery_not_idempotent_for_failed() {
        assert!(!is_recovery_idempotent(RecoveryState::Failed));
    }

    #[test]
    fn repeated_recovery_same_result() {
        let temp = TempDir::new().unwrap();
        let mut manager = TransactionManager::new(temp.path().to_path_buf()).unwrap();
        let destination = temp.path().join("dest.exe");

        // First recovery
        let result1 = recover(&mut manager, &destination, false);
        assert!(result1.is_ok());

        // Second recovery (idempotent)
        let result2 = recover(&mut manager, &destination, false);
        assert!(result2.is_ok());

        // Both should return same action
        assert!(matches!(result1.unwrap(), RecoveryAction::CleanInstall));
        assert!(matches!(result2.unwrap(), RecoveryAction::CleanInstall));
    }

    #[test]
    fn all_recovery_states_have_actions() {
        let states = [
            RecoveryState::CleanInstall,
            RecoveryState::StagedNoDestination,
            RecoveryState::BackedUpNoDestination,
            RecoveryState::Promoting,
            RecoveryState::CompleteWithDestination,
            RecoveryState::AlreadyInstalled,
            RecoveryState::InvalidDestination,
            RecoveryState::Failed,
        ];

        for state in states {
            let _action = determine_recovery_action(state);
            // All states should have a defined action
        }
    }
}
