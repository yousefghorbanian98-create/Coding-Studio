//! OS-backed installation lock with cross-process exclusion.
//!
//! This module provides installation locking using OS primitives:
//! - Windows named mutexes for cross-process exclusion
//! - Version-scoped lock identity
//! - Bounded acquisition with timeout
//! - Automatic release on handle close
//! - Safe stale-owner behavior

use crate::install::error::{InstallError, InstallErrorCode};
use std::time::Duration;

/// Default lock acquisition timeout in milliseconds.
const DEFAULT_LOCK_TIMEOUT_MS: u32 = 30000; // 30 seconds

/// Lock name prefix.
const LOCK_PREFIX: &str = "Global\\CodingStudio_Install_";

/// An installation lock with automatic release.
#[derive(Debug)]
pub struct InstallLock {
    /// Lock identity (version-scoped).
    identity: String,
    /// Lock handle (Windows only).
    #[cfg(windows)]
    handle: std::os::windows::io::RawHandle,
}

impl InstallLock {
    /// Get the lock identity.
    pub fn identity(&self) -> &str {
        &self.identity
    }
}

impl Drop for InstallLock {
    fn drop(&mut self) {
        #[cfg(windows)]
        {
            use windows_sys::Win32::Foundation::CloseHandle;
            use windows_sys::Win32::System::Threading::ReleaseMutex;
            unsafe {
                ReleaseMutex(self.handle);
                CloseHandle(self.handle);
            }
        }
    }
}

/// Acquire an installation lock for a specific version.
///
/// # Arguments
///
/// * `version` - Version string (e.g., "0.81.7")
/// * `timeout` - Optional timeout (defaults to 30 seconds)
///
/// # Returns
///
/// An InstallLock that releases on drop, or an error if acquisition fails.
#[cfg(windows)]
pub fn acquire_lock(version: &str, timeout: Option<Duration>) -> Result<InstallLock, InstallError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::GetLastError;
    use windows_sys::Win32::System::Threading::{CreateMutexW, WaitForSingleObject, WAIT_OBJECT_0};

    let timeout_ms = timeout
        .map(|d| d.as_millis() as u32)
        .unwrap_or(DEFAULT_LOCK_TIMEOUT_MS);

    // Create lock identity
    let identity = format!("{}{}", LOCK_PREFIX, version);
    let identity_wide: Vec<u16> = identity.encode_utf16().chain(Some(0)).collect();

    // Create or open named mutex
    let handle = unsafe { CreateMutexW(std::ptr::null(), 1, identity_wide.as_ptr()) };

    if handle == std::ptr::null_mut() {
        let error = unsafe { GetLastError() };
        return Err(InstallError::new(
            InstallErrorCode::LockFailed,
            format!("Failed to create mutex: error code {}", error),
        ));
    }

    // Wait for ownership
    let wait_result = unsafe { WaitForSingleObject(handle, timeout_ms) };

    if wait_result != WAIT_OBJECT_0 {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(handle);
        }
        return Err(InstallError::new(
            InstallErrorCode::LockFailed,
            format!(
                "Failed to acquire lock within {} ms (another installation may be in progress)",
                timeout_ms
            ),
        ));
    }

    Ok(InstallLock { identity, handle })
}

/// Acquire an installation lock (non-Windows fallback).
///
/// # Security
///
/// This is a fallback for non-Windows platforms. It does NOT provide
/// true cross-process exclusion. Use file-based locking or flock.
#[cfg(not(windows))]
pub fn acquire_lock(version: &str, _timeout: Option<Duration>) -> Result<InstallLock, InstallError> {
    let identity = format!("{}{}", LOCK_PREFIX, version);

    // Non-Windows: use a simple marker (not truly cross-process safe)
    // In production, this should use flock or similar
    Ok(InstallLock { identity })
}

/// Check if a lock is currently held (without acquiring).
///
/// This is useful for diagnostic purposes.
#[cfg(windows)]
pub fn is_lock_held(version: &str) -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::System::Threading::{CreateMutexW, OpenMutexW, SYNCHRONIZE};

    let identity = format!("{}{}", LOCK_PREFIX, version);
    let identity_wide: Vec<u16> = identity.encode_utf16().chain(Some(0)).collect();

    // Try to open existing mutex
    let handle = unsafe { OpenMutexW(SYNCHRONIZE, 0, identity_wide.as_ptr()) };

    if handle != std::ptr::null_mut() {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(handle);
        }
        true
    } else {
        false
    }
}

/// Check if a lock is currently held (non-Windows fallback).
#[cfg(not(windows))]
pub fn is_lock_held(_version: &str) -> bool {
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_identity_includes_version() {
        let lock = acquire_lock("0.81.7", None).unwrap();
        assert!(lock.identity().contains("0.81.7"));
        assert!(lock.identity().starts_with(LOCK_PREFIX));
    }

    #[test]
    fn lock_can_be_acquired_and_released() {
        let version = "test_version_1";
        {
            let _lock = acquire_lock(version, None).unwrap();
            // Lock is held here
        }
        // Lock is released here
    }

    #[cfg(windows)]
    #[test]
    fn concurrent_lock_acquisition_fails() {
        let version = "test_concurrent";
        let lock1 = acquire_lock(version, None).unwrap();

        // Try to acquire the same lock again
        let result = acquire_lock(version, Some(Duration::from_millis(100)));
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::LockFailed);
        assert!(err.message().contains("another installation"));

        drop(lock1);
    }

    #[cfg(windows)]
    #[test]
    fn different_versions_can_lock_simultaneously() {
        let lock1 = acquire_lock("version_1", None).unwrap();
        let lock2 = acquire_lock("version_2", None).unwrap();

        // Both locks should be held
        assert!(lock1.identity().contains("version_1"));
        assert!(lock2.identity().contains("version_2"));
    }

    #[test]
    fn lock_releases_on_drop() {
        let version = "test_drop_release";
        {
            let _lock = acquire_lock(version, None).unwrap();
        }
        // Lock should be released, can acquire again
        let _lock2 = acquire_lock(version, None).unwrap();
    }

    #[test]
    fn lock_timeout_respected() {
        let start = std::time::Instant::now();
        let version = "test_timeout";

        // This should succeed quickly
        let _lock = acquire_lock(version, Some(Duration::from_millis(100))).unwrap();
        let elapsed = start.elapsed();
        assert!(elapsed < Duration::from_millis(200));
    }

    #[test]
    fn lock_identity_format() {
        let lock = acquire_lock("0.81.7", None).unwrap();
        assert_eq!(lock.identity(), "Global\\CodingStudio_Install_0.81.7");
    }
}
