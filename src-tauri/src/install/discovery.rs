//! Executable discovery with explicit and managed sources.
//!
//! This module provides deterministic executable discovery without arbitrary
//! PATH lookup, filename-only trust, or environment fallback for the managed root.

use crate::install::error::{InstallError, InstallErrorCode};
use crate::install::managed_root::{managed_executable_path, validate_containment};
use std::path::{Path, PathBuf};

/// Classification of executable source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceClassification {
    /// Explicitly specified path (not from managed root).
    Explicit,
    /// Discovered in managed root with version and architecture scoping.
    Managed,
}

/// Result of executable discovery.
#[derive(Debug, Clone)]
pub struct DiscoveredExecutable {
    /// Canonical absolute path to the executable.
    pub path: PathBuf,
    /// Source classification.
    pub classification: SourceClassification,
    /// Version string (if managed).
    pub version: Option<String>,
    /// Architecture string (if managed).
    pub arch: Option<String>,
}

/// Discover an executable from an explicit path.
///
/// # Security
///
/// - Validates the path is absolute
/// - Validates the file exists
/// - Does NOT trust PATH
/// - Does NOT trust filename-only
/// - Does NOT perform environment fallback
pub fn discover_explicit(path: &Path) -> Result<DiscoveredExecutable, InstallError> {
    // Validate absolute path
    if !path.is_absolute() {
        return Err(InstallError::with_path(
            InstallErrorCode::DiscoveryFailed,
            format!("explicit path must be absolute: {}", path.display()),
            path,
        ));
    }

    // Validate file exists
    if !path.exists() {
        return Err(InstallError::with_path(
            InstallErrorCode::DiscoveryFailed,
            format!("explicit path does not exist: {}", path.display()),
            path,
        ));
    }

    // Validate it's a file, not a directory
    if !path.is_file() {
        return Err(InstallError::with_path(
            InstallErrorCode::DiscoveryFailed,
            format!("explicit path is not a file: {}", path.display()),
            path,
        ));
    }

    Ok(DiscoveredExecutable {
        path: path.to_path_buf(),
        classification: SourceClassification::Explicit,
        version: None,
        arch: None,
    })
}

/// Discover an executable in the managed root.
///
/// # Security
///
/// - Uses canonical managed path structure
/// - Validates containment within managed root
/// - Version-scoped and architecture-scoped
/// - No PATH trust
/// - No filename-only trust
pub fn discover_managed(
    managed_root: &Path,
    version: &str,
    arch: &str,
    filename: &str,
) -> Result<DiscoveredExecutable, InstallError> {
    // Construct managed path using canonical structure
    let managed_path = managed_executable_path(managed_root, version, arch, filename);

    // Validate containment
    validate_containment(managed_root, &managed_path)?;

    // Validate file exists
    if !managed_path.exists() {
        return Err(InstallError::with_path(
            InstallErrorCode::DiscoveryFailed,
            format!(
                "managed executable not found at version {} arch {}: {}",
                version,
                arch,
                managed_path.display()
            ),
            &managed_path,
        ));
    }

    // Validate it's a file
    if !managed_path.is_file() {
        return Err(InstallError::with_path(
            InstallErrorCode::DiscoveryFailed,
            format!("managed path is not a file: {}", managed_path.display()),
            &managed_path,
        ));
    }

    Ok(DiscoveredExecutable {
        path: managed_path,
        classification: SourceClassification::Managed,
        version: Some(version.to_string()),
        arch: Some(arch.to_string()),
    })
}

/// Attempt to discover an executable, trying managed root first.
///
/// Returns None if not found in managed root. Does NOT fall back to PATH.
pub fn try_discover_managed(
    managed_root: &Path,
    version: &str,
    arch: &str,
    filename: &str,
) -> Option<DiscoveredExecutable> {
    discover_managed(managed_root, version, arch, filename).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn discover_explicit_validates_absolute_path() {
        let relative = Path::new("relative/path/to/exe");
        let result = discover_explicit(relative);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::DiscoveryFailed);
        assert!(err.message().contains("must be absolute"));
    }

    #[test]
    fn discover_explicit_validates_existence() {
        let nonexistent = Path::new("/nonexistent/path/to/exe");
        let result = discover_explicit(nonexistent);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::DiscoveryFailed);
        assert!(err.message().contains("does not exist"));
    }

    #[test]
    fn discover_explicit_accepts_valid_file() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.exe");
        std::fs::write(&file_path, "test content").unwrap();

        let result = discover_explicit(&file_path);
        assert!(result.is_ok());
        let discovered = result.unwrap();
        assert_eq!(discovered.path, file_path);
        assert_eq!(discovered.classification, SourceClassification::Explicit);
        assert!(discovered.version.is_none());
        assert!(discovered.arch.is_none());
    }

    #[test]
    fn discover_explicit_rejects_directory() {
        let temp = TempDir::new().unwrap();
        let dir_path = temp.path().join("subdir");
        std::fs::create_dir(&dir_path).unwrap();

        let result = discover_explicit(&dir_path);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::DiscoveryFailed);
        assert!(err.message().contains("not a file"));
    }

    #[test]
    fn discover_managed_validates_containment() {
        let temp = TempDir::new().unwrap();
        let managed_root = temp.path();

        // Try to escape with path traversal
        let result = discover_managed(managed_root, "0.81.7", "x86_64", "../../escape.exe");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::ContainmentFailure);
    }

    #[test]
    fn discover_managed_validates_existence() {
        let temp = TempDir::new().unwrap();
        let managed_root = temp.path();

        let result = discover_managed(managed_root, "0.81.7", "x86_64", "jcode.exe");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::DiscoveryFailed);
        assert!(err.message().contains("not found"));
    }

    #[test]
    fn discover_managed_accepts_valid_file() {
        let temp = TempDir::new().unwrap();
        let managed_root = temp.path();

        // Create the expected managed path structure
        let exe_path = managed_executable_path(managed_root, "0.81.7", "x86_64", "jcode.exe");
        std::fs::create_dir_all(exe_path.parent().unwrap()).unwrap();
        std::fs::write(&exe_path, "test content").unwrap();

        let result = discover_managed(managed_root, "0.81.7", "x86_64", "jcode.exe");
        assert!(result.is_ok());
        let discovered = result.unwrap();
        assert_eq!(discovered.path, exe_path);
        assert_eq!(discovered.classification, SourceClassification::Managed);
        assert_eq!(discovered.version, Some("0.81.7".to_string()));
        assert_eq!(discovered.arch, Some("x86_64".to_string()));
    }

    #[test]
    fn discover_managed_rejects_directory() {
        let temp = TempDir::new().unwrap();
        let managed_root = temp.path();

        // Create a directory instead of a file
        let exe_path = managed_executable_path(managed_root, "0.81.7", "x86_64", "jcode.exe");
        std::fs::create_dir_all(&exe_path).unwrap();

        let result = discover_managed(managed_root, "0.81.7", "x86_64", "jcode.exe");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::DiscoveryFailed);
        assert!(err.message().contains("not a file"));
    }

    #[test]
    fn try_discover_managed_returns_none_when_missing() {
        let temp = TempDir::new().unwrap();
        let managed_root = temp.path();

        let result = try_discover_managed(managed_root, "0.81.7", "x86_64", "jcode.exe");
        assert!(result.is_none());
    }

    #[test]
    fn try_discover_managed_returns_some_when_found() {
        let temp = TempDir::new().unwrap();
        let managed_root = temp.path();

        let exe_path = managed_executable_path(managed_root, "0.81.7", "x86_64", "jcode.exe");
        std::fs::create_dir_all(exe_path.parent().unwrap()).unwrap();
        std::fs::write(&exe_path, "test content").unwrap();

        let result = try_discover_managed(managed_root, "0.81.7", "x86_64", "jcode.exe");
        assert!(result.is_some());
        let discovered = result.unwrap();
        assert_eq!(discovered.path, exe_path);
    }

    #[test]
    fn path_poisoning_attempt_rejected() {
        // Simulate PATH poisoning by trying to discover from a fake PATH entry
        let temp = TempDir::new().unwrap();
        let fake_path = temp.path().join("malicious.exe");
        std::fs::write(&fake_path, "malicious").unwrap();

        // This should work for explicit discovery (user-provided path)
        let result = discover_explicit(&fake_path);
        assert!(result.is_ok());

        // But managed discovery should never use PATH
        let managed_root = temp.path().join("managed");
        std::fs::create_dir_all(&managed_root).unwrap();
        let result = discover_managed(&managed_root, "0.81.7", "x86_64", "jcode.exe");
        assert!(result.is_err());
    }

    #[test]
    fn filename_only_impostor_rejected_in_managed() {
        let temp = TempDir::new().unwrap();
        let managed_root = temp.path();

        // Create a file with the right name but wrong location
        let impostor = managed_root.join("jcode.exe");
        std::fs::write(&impostor, "impostor").unwrap();

        // Managed discovery should look in version-scoped path, not root
        let result = discover_managed(managed_root, "0.81.7", "x86_64", "jcode.exe");
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::DiscoveryFailed);
    }
}
