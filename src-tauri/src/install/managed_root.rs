//! Managed root path derivation for Jcode installation.
//!
//! Production managed root is derived from Windows per-user LocalAppData
//! using SHGetKnownFolderPath (windows-sys), not from PATH search or
//! environment variables.

use crate::install::error::{InstallError, InstallErrorCode};
use std::path::{Path, PathBuf};

/// Product directory name under LocalAppData.
const PRODUCT_DIR: &str = "CodingStudio";

/// Jcode subdirectory under product root.
const JCODE_DIR: &str = "jcode";

/// Derive the production managed root from Windows per-user LocalAppData.
///
/// Returns: %LOCALAPPDATA%\CodingStudio\jcode
///
/// Uses SHGetKnownFolderPath via windows-sys crate.
/// On non-Windows platforms, returns UnsupportedHost.
pub fn production_managed_root() -> Result<PathBuf, InstallError> {
    #[cfg(windows)]
    {
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;
        use windows_sys::Win32::UI::Shell::{SHGetKnownFolderPath, FOLDERID_LocalAppData};
        use windows_sys::Win32::System::Com::CoTaskMemFree;
        use windows_sys::core::PWSTR;
        
        // SAFETY: We're calling Windows API functions with proper parameter types.
        // - FOLDERID_LocalAppData is a valid GUID constant
        // - hToken=0 means current user (null handle)
        // - path_ptr is initialized to null and will be set by SHGetKnownFolderPath
        // - We check the HRESULT and null pointer before use
        // - We bound the UTF-16 length scan to prevent runaway
        // - We free the allocated memory with CoTaskMemFree before returning
        unsafe {
            let mut path_ptr: PWSTR = std::ptr::null_mut();
            let hr = SHGetKnownFolderPath(
                &FOLDERID_LocalAppData as *const _,
                0, // No flags
                0, // Current user (null handle)
                &mut path_ptr,
            );
            
            if hr != 0 || path_ptr.is_null() {
                return Err(InstallError::new(
                    InstallErrorCode::StagingFailed,
                    format!("SHGetKnownFolderPath failed: HRESULT 0x{:08X}", hr),
                ));
            }
            
            // Count wide chars until null terminator (bounded to prevent runaway)
            let mut len = 0;
            const MAX_PATH_CHARS: usize = 32768; // Windows max path
            while len < MAX_PATH_CHARS && *path_ptr.add(len) != 0 {
                len += 1;
            }
            
            if len >= MAX_PATH_CHARS {
                CoTaskMemFree(path_ptr as *mut _);
                return Err(InstallError::new(
                    InstallErrorCode::StagingFailed,
                    "SHGetKnownFolderPath returned path exceeding maximum length",
                ));
            }
            
            let wide_slice = std::slice::from_raw_parts(path_ptr, len);
            let os_string = OsString::from_wide(wide_slice);
            CoTaskMemFree(path_ptr as *mut _);
            
            let local_app_data = PathBuf::from(os_string);
            Ok(local_app_data.join(PRODUCT_DIR).join(JCODE_DIR))
        }
    }
    
    #[cfg(not(windows))]
    {
        Err(InstallError::new(
            InstallErrorCode::UnsupportedHost,
            "managed root derivation is Windows-only",
        ))
    }
}

/// Construct the full managed executable path.
pub fn managed_executable_path(
    managed_root: &Path,
    version: &str,
    arch: crate::install::architecture::SupportedArch,
) -> PathBuf {
    let arch_dir = match arch {
        crate::install::architecture::SupportedArch::X86_64 => "x86_64",
        crate::install::architecture::SupportedArch::AArch64 => "aarch64",
    };
    managed_root.join(version).join(arch_dir).join("jcode.exe")
}

/// Validate that a path is contained within a root directory.
pub fn validate_containment(root: &Path, candidate: &Path) -> Result<(), InstallError> {
    let canonical_root = root.canonicalize().map_err(|_e| {
        InstallError::with_path(
            InstallErrorCode::ContainmentFailure,
            "failed to canonicalize root",
            root,
        )
    })?;

    let canonical_candidate = candidate.canonicalize().map_err(|_e| {
        InstallError::with_path(
            InstallErrorCode::ContainmentFailure,
            "failed to canonicalize candidate path",
            candidate,
        )
    })?;

    if !canonical_candidate.starts_with(&canonical_root) {
        return Err(InstallError::with_path(
            InstallErrorCode::ContainmentFailure,
            "path escapes managed root",
            candidate,
        ));
    }

    Ok(())
}

/// Check if a path is a reparse point (symlink, junction, etc.).
pub fn is_reparse_point(path: &Path) -> Result<bool, InstallError> {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;

        let metadata = std::fs::symlink_metadata(path).map_err(|_e| {
            InstallError::with_path(
                InstallErrorCode::StagingFailed,
                "failed to read metadata",
                path,
            )
        })?;

        const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
        Ok((metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT) != 0)
    }

    #[cfg(not(windows))]
    {
        let metadata = std::fs::symlink_metadata(path).map_err(|_e| {
            InstallError::with_path(
                InstallErrorCode::StagingFailed,
                "failed to read metadata",
                path,
            )
        })?;

        Ok(metadata.file_type().is_symlink())
    }
}

/// Validate that no component of a path is a reparse point.
pub fn validate_no_reparse_points(root: &Path, candidate: &Path) -> Result<(), InstallError> {
    let mut current = root.to_path_buf();
    
    let relative = candidate.strip_prefix(root).map_err(|_| {
        InstallError::with_path(
            InstallErrorCode::ContainmentFailure,
            "candidate is not under root",
            candidate,
        )
    })?;
    
    for component in relative.components() {
        current.push(component);
        
        if current.exists() && is_reparse_point(&current)? {
            return Err(InstallError::with_path(
                InstallErrorCode::ReparsePoint,
                "reparse point detected in managed path",
                &current,
            ));
        }
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn managed_executable_path_structure() {
        use crate::install::architecture::SupportedArch;
        
        let root = PathBuf::from("C:\\Users\\test\\AppData\\Local\\CodingStudio\\jcode");
        let path = managed_executable_path(&root, "0.81.7", SupportedArch::X86_64);
        
        assert_eq!(
            path,
            PathBuf::from("C:\\Users\\test\\AppData\\Local\\CodingStudio\\jcode\\0.81.7\\x86_64\\jcode.exe")
        );
    }

    #[test]
    fn validate_containment_accepts_contained_path() {
        let temp = TempDir::new().unwrap();
        let root = temp.path();
        let candidate = root.join("subdir").join("file.txt");
        
        fs::create_dir_all(candidate.parent().unwrap()).unwrap();
        fs::write(&candidate, "test").unwrap();
        
        assert!(validate_containment(root, &candidate).is_ok());
    }

    #[test]
    fn validate_containment_rejects_escape() {
        let temp = TempDir::new().unwrap();
        let root = temp.path().join("root");
        let escape = temp.path().join("escape.txt");
        fs::create_dir_all(&root).unwrap();
        fs::write(&escape, "test").unwrap();
        let err = validate_containment(&root, &escape).unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::ContainmentFailure);
    }

    #[test]
    fn validate_containment_rejects_traversal() {
        let temp = TempDir::new().unwrap();
        let root = temp.path().join("root");
        let candidate = root.join("..").join("escape.txt");
        fs::create_dir_all(&root).unwrap();
        fs::write(temp.path().join("escape.txt"), "test").unwrap();
        let err = validate_containment(&root, &candidate).unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::ContainmentFailure);
    }

    #[test]
    fn reparse_point_detection() {
        let temp = TempDir::new().unwrap();
        let regular = temp.path().join("regular.txt");
        fs::write(&regular, "test").unwrap();
        assert!(!is_reparse_point(&regular).unwrap());
    }
}
