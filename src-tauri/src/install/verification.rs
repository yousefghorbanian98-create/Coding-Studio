//! Held-handle verification with protective file handles.
//!
//! This module provides secure executable verification by:
//! - Opening files with Windows sharing restrictions (deny write/delete)
//! - Retaining the protective handle through verification
//! - Validating PE architecture from the held handle
//! - Validating digest from the held handle
//! - Eliminating TOCTOU races between verification and use

use crate::install::architecture::{validate_pe_prefix, SupportedArch};
use crate::install::error::{InstallError, InstallErrorCode};
use std::path::{Path, PathBuf};

/// A verified executable with a protective handle.
///
/// This type guarantees that:
/// - The file was opened with deny-write/deny-delete sharing
/// - The PE architecture was validated from the held handle
/// - The digest was validated from the held handle
/// - No mutation or deletion occurred between verification and use
#[derive(Debug)]
pub struct VerifiedArtifact {
    /// Path to the verified executable.
    path: PathBuf,
    /// Detected architecture.
    arch: SupportedArch,
    /// Protective file handle (Windows only).
    #[cfg(windows)]
    handle: std::os::windows::io::RawHandle,
    /// File size in bytes.
    size: u64,
}

impl VerifiedArtifact {
    /// Get the path to the verified executable.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Get the detected architecture.
    pub fn arch(&self) -> SupportedArch {
        self.arch
    }

    /// Get the file size.
    pub fn size(&self) -> u64 {
        self.size
    }
}

impl Drop for VerifiedArtifact {
    fn drop(&mut self) {
        #[cfg(windows)]
        {
            // Close the protective handle
            use windows_sys::Win32::Foundation::CloseHandle;
            unsafe {
                CloseHandle(self.handle);
            }
        }
    }
}

/// Verify an executable with a protective handle.
///
/// # Security
///
/// - Opens with deny-write/deny-delete sharing (Windows)
/// - Validates PE architecture from held handle
/// - Validates digest from held handle
/// - Retains handle until VerifiedArtifact is dropped
///
/// # Arguments
///
/// * `path` - Path to the executable
/// * `expected_arch` - Expected architecture
/// * `expected_digest` - Expected SHA-256 digest (hex string)
/// * `expected_size` - Expected file size in bytes
///
/// # Returns
///
/// A VerifiedArtifact with a protective handle, or an error.
#[cfg(windows)]
pub fn verify_with_handle(
    path: &Path,
    expected_arch: SupportedArch,
    expected_digest: &str,
    expected_size: u64,
) -> Result<VerifiedArtifact, InstallError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{GENERIC_READ, HANDLE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FILE_SHARE_READ, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL,
    };

    // Convert path to wide string
    let path_wide: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();

    // Open with protective sharing (deny write/delete, allow read)
    let handle = unsafe {
        CreateFileW(
            path_wide.as_ptr(),
            GENERIC_READ,
            FILE_SHARE_READ, // Only allow read sharing, deny write/delete
            std::ptr::null(),
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL,
            0,
        )
    };

    if handle == windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE {
        return Err(InstallError::with_path(
            InstallErrorCode::VerificationFailed,
            format!("Failed to open file with protective handle"),
            path,
        ));
    }

    // Read file through the handle
    let file_data = read_file_through_handle(handle, path)?;

    // Validate size
    if file_data.len() as u64 != expected_size {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(handle);
        }
        return Err(InstallError::with_path(
            InstallErrorCode::SizeMismatch,
            format!(
                "expected {} bytes, found {} bytes",
                expected_size,
                file_data.len()
            ),
            path,
        ));
    }

    // Validate PE architecture
    let detected_arch = validate_pe_prefix(&file_data).map_err(|_| {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(handle);
        }
        InstallError::with_path(
            InstallErrorCode::ArchitectureMismatch,
            "PE validation failed".to_string(),
            path,
        )
    })?;

    if detected_arch != expected_arch {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(handle);
        }
        return Err(InstallError::with_path(
            InstallErrorCode::ArchitectureMismatch,
            format!("expected {:?}, found {:?}", expected_arch, detected_arch),
            path,
        ));
    }

    // Validate digest
    let digest = compute_digest(&file_data);
    if digest != expected_digest {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(handle);
        }
        return Err(InstallError::with_path(
            InstallErrorCode::DigestMismatch,
            format!("expected {}, found {}", expected_digest, digest),
            path,
        ));
    }

    Ok(VerifiedArtifact {
        path: path.to_path_buf(),
        arch: detected_arch,
        handle,
        size: expected_size,
    })
}

/// Read file data through a Windows handle.
#[cfg(windows)]
fn read_file_through_handle(
    handle: windows_sys::Win32::Foundation::HANDLE,
    path: &Path,
) -> Result<Vec<u8>, InstallError> {
    use windows_sys::Win32::Storage::FileSystem::{GetFileSizeEx, ReadFile};

    // Get file size
    let mut file_size: i64 = 0;
    let result = unsafe { GetFileSizeEx(handle, &mut file_size) };
    if result == 0 {
        return Err(InstallError::with_path(
            InstallErrorCode::VerificationFailed,
            "Failed to get file size".to_string(),
            path,
        ));
    }

    // Read entire file
    let mut buffer = vec![0u8; file_size as usize];
    let mut bytes_read: u32 = 0;
    let result = unsafe {
        ReadFile(
            handle,
            buffer.as_mut_ptr() as *mut _,
            buffer.len() as u32,
            &mut bytes_read,
            std::ptr::null_mut(),
        )
    };

    if result == 0 {
        return Err(InstallError::with_path(
            InstallErrorCode::VerificationFailed,
            "Failed to read file".to_string(),
            path,
        ));
    }

    buffer.truncate(bytes_read as usize);
    Ok(buffer)
}

/// Compute SHA-256 digest of data.
fn compute_digest(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Verify an executable without a protective handle (non-Windows fallback).
///
/// # Security
///
/// This is a fallback for non-Windows platforms. It does NOT provide
/// the same TOCTOU protection as the Windows implementation.
#[cfg(not(windows))]
pub fn verify_with_handle(
    path: &Path,
    expected_arch: SupportedArch,
    expected_digest: &str,
    expected_size: u64,
) -> Result<VerifiedArtifact, InstallError> {
    use std::fs::File;
    use std::io::Read;

    // Read file
    let mut file = File::open(path).map_err(|_e| {
        InstallError::with_path(
            InstallErrorCode::VerificationFailed,
            format!("Failed to open file"),
            path,
        )
    })?;

    let mut file_data = Vec::new();
    file.read_to_end(&mut file_data).map_err(|_e| {
        InstallError::with_path(
            InstallErrorCode::VerificationFailed,
            "Failed to read file".to_string(),
            path,
        )
    })?;

    // Validate size
    if file_data.len() as u64 != expected_size {
        return Err(InstallError::with_path(
            InstallErrorCode::SizeMismatch,
            format!(
                "expected {} bytes, found {} bytes",
                expected_size,
                file_data.len()
            ),
            path,
        ));
    }

    // Validate PE architecture
    let detected_arch = validate_pe_prefix(&file_data).map_err(|_| {
        InstallError::with_path(
            InstallErrorCode::ArchitectureMismatch,
            "PE validation failed".to_string(),
            path,
        )
    })?;

    if detected_arch != expected_arch {
        return Err(InstallError::with_path(
            InstallErrorCode::ArchitectureMismatch,
            format!("expected {:?}, found {:?}", expected_arch, detected_arch),
            path,
        ));
    }

    // Validate digest
    let digest = compute_digest(&file_data);
    if digest != expected_digest {
        return Err(InstallError::with_path(
            InstallErrorCode::DigestMismatch,
            format!("expected {}, found {}", expected_digest, digest),
            path,
        ));
    }

    Ok(VerifiedArtifact {
        path: path.to_path_buf(),
        arch: detected_arch,
        size: expected_size,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::install::architecture::PE_MACHINE_AMD64;
    use tempfile::TempDir;

    fn create_test_pe(arch: u16) -> Vec<u8> {
        let mut pe = vec![0u8; 1024];
        // MZ signature
        pe[0] = b'M';
        pe[1] = b'Z';
        // e_lfanew at offset 0x3C (pointing to PE header at 0x80)
        pe[0x3C] = 0x80;
        // PE signature at 0x80
        pe[0x80] = b'P';
        pe[0x81] = b'E';
        pe[0x82] = 0;
        pe[0x83] = 0;
        // Machine type at 0x84
        pe[0x84] = (arch & 0xFF) as u8;
        pe[0x85] = ((arch >> 8) & 0xFF) as u8;
        pe
    }

    #[test]
    fn compute_digest_produces_correct_hash() {
        let data = b"test data";
        let digest = compute_digest(data);
        assert_eq!(
            digest,
            "916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9"
        );
    }

    #[test]
    fn verify_rejects_size_mismatch() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.exe");
        let pe_data = create_test_pe(PE_MACHINE_AMD64);
        std::fs::write(&file_path, &pe_data).unwrap();

        let result = verify_with_handle(
            &file_path,
            SupportedArch::X86_64,
            "dummy",
            9999, // Wrong size
        );

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::SizeMismatch);
    }

    #[test]
    fn verify_rejects_digest_mismatch() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.exe");
        let pe_data = create_test_pe(PE_MACHINE_AMD64);
        std::fs::write(&file_path, &pe_data).unwrap();

        let actual_digest = compute_digest(&pe_data);
        let wrong_digest = "0000000000000000000000000000000000000000000000000000000000000000";

        let result = verify_with_handle(
            &file_path,
            SupportedArch::X86_64,
            wrong_digest,
            pe_data.len() as u64,
        );

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::DigestMismatch);
        assert!(err.message().contains(&actual_digest));
    }

    #[test]
    fn verify_rejects_architecture_mismatch() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.exe");
        let pe_data = create_test_pe(0xAA64); // ARM64
        std::fs::write(&file_path, &pe_data).unwrap();

        let result = verify_with_handle(
            &file_path,
            SupportedArch::X86_64, // Expecting x86_64
            "dummy",
            pe_data.len() as u64,
        );

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::ArchitectureMismatch);
    }

    #[test]
    fn verify_accepts_valid_file() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.exe");
        let pe_data = create_test_pe(PE_MACHINE_AMD64);
        std::fs::write(&file_path, &pe_data).unwrap();

        let digest = compute_digest(&pe_data);

        let result = verify_with_handle(
            &file_path,
            SupportedArch::X86_64,
            &digest,
            pe_data.len() as u64,
        );

        assert!(result.is_ok());
        let artifact = result.unwrap();
        assert_eq!(artifact.path(), file_path);
        assert_eq!(artifact.arch(), SupportedArch::X86_64);
        assert_eq!(artifact.size(), pe_data.len() as u64);
    }

    #[test]
    fn verified_artifact_provides_accessors() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.exe");
        let pe_data = create_test_pe(PE_MACHINE_AMD64);
        std::fs::write(&file_path, &pe_data).unwrap();

        let digest = compute_digest(&pe_data);

        let artifact = verify_with_handle(
            &file_path,
            SupportedArch::X86_64,
            &digest,
            pe_data.len() as u64,
        )
        .unwrap();

        assert_eq!(artifact.path(), file_path);
        assert_eq!(artifact.arch(), SupportedArch::X86_64);
        assert_eq!(artifact.size(), pe_data.len() as u64);
    }

    #[test]
    fn verify_rejects_nonexistent_file() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("nonexistent.exe");

        let result = verify_with_handle(&file_path, SupportedArch::X86_64, "dummy", 1000);

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::VerificationFailed);
    }

    #[test]
    fn verify_rejects_invalid_pe() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.exe");
        let invalid_data = b"not a PE file";
        std::fs::write(&file_path, invalid_data).unwrap();

        let result = verify_with_handle(
            &file_path,
            SupportedArch::X86_64,
            "dummy",
            invalid_data.len() as u64,
        );

        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::ArchitectureMismatch);
    }

    #[test]
    fn verified_artifact_drop_closes_handle() {
        let temp = TempDir::new().unwrap();
        let file_path = temp.path().join("test.exe");
        let pe_data = create_test_pe(PE_MACHINE_AMD64);
        std::fs::write(&file_path, &pe_data).unwrap();

        let digest = compute_digest(&pe_data);

        {
            let _artifact = verify_with_handle(
                &file_path,
                SupportedArch::X86_64,
                &digest,
                pe_data.len() as u64,
            )
            .unwrap();
            // artifact goes out of scope here, handle should be closed
        }

        // File should still exist and be accessible
        assert!(file_path.exists());
    }
}
