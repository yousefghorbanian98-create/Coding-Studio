//! Architecture detection and Windows PE validation.
//!
//! Supports exactly two Windows architectures:
//! - x86_64-pc-windows-msvc (AMD64, machine type 0x8664)
//! - aarch64-pc-windows-msvc (ARM64, machine type 0xAA64)

use crate::install::error::{InstallError, InstallErrorCode};
use std::path::Path;

/// Windows PE machine types we recognize.
const PE_MACHINE_AMD64: u16 = 0x8664;
const PE_MACHINE_ARM64: u16 = 0xAA64;

/// Maximum bytes to read for PE validation (DOS header + PE header).
const PE_PREFIX_MAX: usize = 512;

/// Supported Windows architectures for Jcode installation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SupportedArch {
    X86_64,
    AArch64,
}

impl SupportedArch {
    /// Detect the host architecture at compile time.
    pub fn host() -> Result<Self, InstallError> {
        #[cfg(target_arch = "x86_64")]
        return Ok(Self::X86_64);
        
        #[cfg(target_arch = "aarch64")]
        return Ok(Self::AArch64);
        
        #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
        Err(InstallError::new(
            InstallErrorCode::ArchitectureMismatch,
            "unsupported host architecture",
        ))
    }
    
    /// Map from PE machine type.
    pub fn from_pe_machine(machine: u16) -> Option<Self> {
        match machine {
            PE_MACHINE_AMD64 => Some(Self::X86_64),
            PE_MACHINE_ARM64 => Some(Self::AArch64),
            _ => None,
        }
    }
    
    /// Expected PE machine type for this architecture.
    pub fn pe_machine(self) -> u16 {
        match self {
            Self::X86_64 => PE_MACHINE_AMD64,
            Self::AArch64 => PE_MACHINE_ARM64,
        }
    }
    
    /// Rust target triple.
    pub fn rust_target(self) -> &'static str {
        match self {
            Self::X86_64 => "x86_64-pc-windows-msvc",
            Self::AArch64 => "aarch64-pc-windows-msvc",
        }
    }
}

/// Validate a PE executable prefix and extract the machine type.
pub fn validate_pe_prefix(bytes: &[u8]) -> Result<SupportedArch, InstallError> {
    if bytes.len() < 64 {
        return Err(InstallError::new(
            InstallErrorCode::MalformedPe,
            "file too small for DOS header",
        ));
    }
    
    // Validate MZ signature
    if &bytes[0..2] != b"MZ" {
        return Err(InstallError::new(
            InstallErrorCode::MalformedPe,
            "missing MZ signature",
        ));
    }
    
    // Read e_lfanew (PE header offset) at offset 0x3C
    let e_lfanew = u32::from_le_bytes([
        bytes[0x3C],
        bytes[0x3D],
        bytes[0x3E],
        bytes[0x3F],
    ]) as usize;
    
    // Validate e_lfanew is within bounds
    if e_lfanew.checked_add(24).map_or(true, |end| end > bytes.len()) {
        return Err(InstallError::new(
            InstallErrorCode::MalformedPe,
            "e_lfanew points outside file",
        ));
    }
    
    // Validate PE signature
    if &bytes[e_lfanew..e_lfanew + 4] != b"PE\0\0" {
        return Err(InstallError::new(
            InstallErrorCode::MalformedPe,
            "missing PE signature",
        ));
    }
    
    // Read COFF Machine field at e_lfanew + 4
    let machine = u16::from_le_bytes([
        bytes[e_lfanew + 4],
        bytes[e_lfanew + 5],
    ]);
    
    SupportedArch::from_pe_machine(machine).ok_or_else(|| {
        InstallError::new(
            InstallErrorCode::ArchitectureMismatch,
            format!("unsupported PE machine type: 0x{:04X}", machine),
        )
    })
}

/// Validate a PE file from a path, reading only the prefix.
pub fn validate_pe_file(path: &Path) -> Result<SupportedArch, InstallError> {
    use std::fs::File;
    use std::io::Read;
    
    let mut file = File::open(path).map_err(|_e| {
        InstallError::with_path(
            InstallErrorCode::StagingFailed,
            "failed to open PE file",
            path,
        )
    })?;
    
    let mut prefix = vec![0u8; PE_PREFIX_MAX];
    let bytes_read = file.read(&mut prefix).map_err(|_e| {
        InstallError::with_path(
            InstallErrorCode::StagingFailed,
            "failed to read PE prefix",
            path,
        )
    })?;
    
    prefix.truncate(bytes_read);
    validate_pe_prefix(&prefix)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_architecture_is_detected() {
        let arch = SupportedArch::host().unwrap();
        assert!(matches!(arch, SupportedArch::X86_64 | SupportedArch::AArch64));
    }

    #[test]
    fn pe_machine_mapping() {
        assert_eq!(
            SupportedArch::from_pe_machine(0x8664),
            Some(SupportedArch::X86_64)
        );
        assert_eq!(
            SupportedArch::from_pe_machine(0xAA64),
            Some(SupportedArch::AArch64)
        );
        assert_eq!(SupportedArch::from_pe_machine(0x014C), None);
    }

    #[test]
    fn validate_synthetic_x86_64_pe() {
        let mut bytes = vec![0u8; 128];
        bytes[0..2].copy_from_slice(b"MZ");
        bytes[0x3C..0x40].copy_from_slice(&64u32.to_le_bytes());
        bytes[64..68].copy_from_slice(b"PE\0\0");
        bytes[68..70].copy_from_slice(&0x8664u16.to_le_bytes());
        
        let arch = validate_pe_prefix(&bytes).unwrap();
        assert_eq!(arch, SupportedArch::X86_64);
    }

    #[test]
    fn validate_synthetic_arm64_pe() {
        let mut bytes = vec![0u8; 128];
        bytes[0..2].copy_from_slice(b"MZ");
        bytes[0x3C..0x40].copy_from_slice(&64u32.to_le_bytes());
        bytes[64..68].copy_from_slice(b"PE\0\0");
        bytes[68..70].copy_from_slice(&0xAA64u16.to_le_bytes());
        
        let arch = validate_pe_prefix(&bytes).unwrap();
        assert_eq!(arch, SupportedArch::AArch64);
    }

    #[test]
    fn reject_missing_mz() {
        let mut bytes = vec![0u8; 128];
        bytes[0..2].copy_from_slice(b"XX");
        bytes[0x3C..0x40].copy_from_slice(&64u32.to_le_bytes());
        bytes[64..68].copy_from_slice(b"PE\0\0");
        bytes[68..70].copy_from_slice(&0x8664u16.to_le_bytes());
        
        let err = validate_pe_prefix(&bytes).unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::MalformedPe);
    }

    #[test]
    fn reject_unsupported_machine() {
        let mut bytes = vec![0u8; 128];
        bytes[0..2].copy_from_slice(b"MZ");
        bytes[0x3C..0x40].copy_from_slice(&64u32.to_le_bytes());
        bytes[64..68].copy_from_slice(b"PE\0\0");
        bytes[68..70].copy_from_slice(&0x014Cu16.to_le_bytes());
        
        let err = validate_pe_prefix(&bytes).unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::ArchitectureMismatch);
    }

    #[test]
    fn reject_out_of_bounds_e_lfanew() {
        let mut bytes = vec![0u8; 128];
        bytes[0..2].copy_from_slice(b"MZ");
        bytes[0x3C..0x40].copy_from_slice(&200u32.to_le_bytes());
        bytes[64..68].copy_from_slice(b"PE\0\0");
        
        let err = validate_pe_prefix(&bytes).unwrap_err();
        assert_eq!(err.code(), InstallErrorCode::MalformedPe);
    }
}
