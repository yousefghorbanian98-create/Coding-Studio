//! Stable error codes for the managed Jcode installation subsystem.
//!
//! Codes are part of the product contract: they never change meaning once
//! assigned. Every message is redacted and length-capped before storage.

use std::fmt;

/// Maximum length of any stored error message.
pub const MAX_ERROR_MESSAGE: usize = 240;

/// Stable machine-readable codes for installer errors.
/// Numeric ranges: `E20xx` discovery, `E21xx` download, `E22xx` verification,
/// `E23xx` locking, `E24xx` transaction/recovery, `E25xx` promotion.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstallErrorCode {
    // Discovery errors (E20xx)
    UnsupportedHost,
    InvalidExplicitPath,
    RelativePath,
    FilenameOnlyPath,
    ReparsePoint,
    ContainmentFailure,
    OwnershipFailure,
    
    // Download errors (E21xx)
    LockTimeout,
    RecoveryCorruption,
    InvalidTransactionState,
    UnauthorizedRedirect,
    HttpDowngrade,
    NetworkTimeout,
    AggregateTimeout,
    HttpStatus,
    ContentEncoding,
    ContentLength,
    
    // Verification errors (E22xx)
    SizeMismatch,
    ChecksumMismatch,
    MalformedPe,
    ArchitectureMismatch,
    
    // Transaction errors (E23xx)
    StagingFailed,
    FlushFailed,
    PromotionFailed,
    RollbackFailed,
    FinalVerificationFailed,
    CleanupFailed,
}

impl InstallErrorCode {
    /// Stable `INSTALL-Exxxx` spelling.
    pub fn code(self) -> &'static str {
        match self {
            Self::UnsupportedHost => "INSTALL-E2001",
            Self::InvalidExplicitPath => "INSTALL-E2002",
            Self::RelativePath => "INSTALL-E2003",
            Self::FilenameOnlyPath => "INSTALL-E2004",
            Self::ReparsePoint => "INSTALL-E2005",
            Self::ContainmentFailure => "INSTALL-E2006",
            Self::OwnershipFailure => "INSTALL-E2007",
            
            Self::LockTimeout => "INSTALL-E2101",
            Self::RecoveryCorruption => "INSTALL-E2102",
            Self::InvalidTransactionState => "INSTALL-E2103",
            Self::UnauthorizedRedirect => "INSTALL-E2104",
            Self::HttpDowngrade => "INSTALL-E2105",
            Self::NetworkTimeout => "INSTALL-E2106",
            Self::AggregateTimeout => "INSTALL-E2107",
            Self::HttpStatus => "INSTALL-E2108",
            Self::ContentEncoding => "INSTALL-E2109",
            Self::ContentLength => "INSTALL-E2110",
            
            Self::SizeMismatch => "INSTALL-E2201",
            Self::ChecksumMismatch => "INSTALL-E2202",
            Self::MalformedPe => "INSTALL-E2203",
            Self::ArchitectureMismatch => "INSTALL-E2204",
            
            Self::StagingFailed => "INSTALL-E2301",
            Self::FlushFailed => "INSTALL-E2302",
            Self::PromotionFailed => "INSTALL-E2303",
            Self::RollbackFailed => "INSTALL-E2304",
            Self::FinalVerificationFailed => "INSTALL-E2305",
            Self::CleanupFailed => "INSTALL-E2306",
        }
    }

    /// One-line human summary, free of dynamic content.
    pub fn summary(self) -> &'static str {
        match self {
            Self::UnsupportedHost => "unsupported host platform",
            Self::InvalidExplicitPath => "invalid explicit executable path",
            Self::RelativePath => "relative path not permitted",
            Self::FilenameOnlyPath => "filename-only path not permitted",
            Self::ReparsePoint => "reparse point detected",
            Self::ContainmentFailure => "path containment validation failed",
            Self::OwnershipFailure => "ownership or ACL validation failed",
            
            Self::LockTimeout => "lock acquisition timeout",
            Self::RecoveryCorruption => "recovery state corruption",
            Self::InvalidTransactionState => "invalid transaction state",
            Self::UnauthorizedRedirect => "unauthorized redirect",
            Self::HttpDowngrade => "HTTPS downgrade detected",
            Self::NetworkTimeout => "network operation timeout",
            Self::AggregateTimeout => "aggregate retry ceiling exceeded",
            Self::HttpStatus => "unexpected HTTP status",
            Self::ContentEncoding => "unsupported content encoding",
            Self::ContentLength => "content length validation failed",
            
            Self::SizeMismatch => "executable size mismatch",
            Self::ChecksumMismatch => "checksum mismatch",
            Self::MalformedPe => "malformed PE executable",
            Self::ArchitectureMismatch => "architecture mismatch",
            
            Self::StagingFailed => "staging operation failed",
            Self::FlushFailed => "file flush failed",
            Self::PromotionFailed => "promotion to final failed",
            Self::RollbackFailed => "rollback restoration failed",
            Self::FinalVerificationFailed => "final verification failed",
            Self::CleanupFailed => "cleanup operation failed",
        }
    }
    
    /// Whether this error is potentially retryable (transient).
    pub fn is_retryable(self) -> bool {
        matches!(
            self,
            Self::LockTimeout
                | Self::NetworkTimeout
                | Self::AggregateTimeout
                | Self::HttpStatus
                | Self::StagingFailed
                | Self::FlushFailed
                | Self::PromotionFailed
                | Self::CleanupFailed
        )
    }
}

/// Redacted, length-capped, coded error for the installer boundary.
pub struct InstallError {
    code: InstallErrorCode,
    message: String,
}

impl InstallError {
    /// Build an error; the detail string is redacted and capped on the way in.
    pub fn new(code: InstallErrorCode, detail: impl AsRef<str>) -> Self {
        Self {
            code,
            message: Self::redact_and_cap(detail.as_ref()),
        }
    }
    
    /// Build an error with a path context (bounded and redacted).
    pub fn with_path(code: InstallErrorCode, detail: &str, path: &std::path::Path) -> Self {
        let bounded_path = Self::bound_path(path);
        let message = format!("{}: {}", detail, bounded_path);
        Self {
            code,
            message: Self::redact_and_cap(&message),
        }
    }

    pub fn code(&self) -> InstallErrorCode {
        self.code
    }

    /// Redacted detail text (no secrets, no control characters).
    pub fn message(&self) -> &str {
        &self.message
    }
    
    fn redact_and_cap(s: &str) -> String {
        // Use M1's redaction boundary: redact first, then bound
        // This ensures secrets are fully removed before truncation
        let redacted = crate::jcode::auth::redact(s);
        crate::jcode::auth::bounded(&redacted, MAX_ERROR_MESSAGE)
    }
    
    fn bound_path(path: &std::path::Path) -> String {
        let s = path.to_string_lossy();
        if s.len() > 96 {
            format!("[{}...{}]", &s[..20], &s[s.len()-20..])
        } else {
            s.into_owned()
        }
    }
}

impl fmt::Display for InstallError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} {}: {}",
            self.code.code(),
            self.code.summary(),
            self.message
        )
    }
}

impl fmt::Debug for InstallError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Debug mirrors Display: printing must never leak un-redacted detail.
        fmt::Display::fmt(self, f)
    }
}

impl std::error::Error for InstallError {}

impl From<std::io::Error> for InstallError {
    fn from(err: std::io::Error) -> Self {
        InstallError::new(InstallErrorCode::StagingFailed, err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_stable_strings() {
        assert_eq!(InstallErrorCode::SizeMismatch.code(), "INSTALL-E2201");
        assert_eq!(InstallErrorCode::PromotionFailed.code(), "INSTALL-E2303");
    }

    #[test]
    fn messages_are_redacted_and_capped() {
        let secret = format!("token=sk-{}", "A".repeat(400));
        let err = InstallError::new(InstallErrorCode::StagingFailed, secret);
        let shown = err.to_string();
        assert!(
            !shown.contains("sk-"),
            "secret shape must be redacted: {shown}"
        );
        assert!(shown.len() < 500, "message must be capped");
        assert!(shown.contains("[REDACTED]"), "redaction marker expected");
    }

    #[test]
    fn display_includes_code_and_summary() {
        let err = InstallError::new(InstallErrorCode::SizeMismatch, "expected 128 bytes");
        let s = err.to_string();
        assert!(s.starts_with("INSTALL-E2201 executable size mismatch: "));
    }

    #[test]
    fn retryability_classification() {
        assert!(InstallErrorCode::NetworkTimeout.is_retryable());
        assert!(InstallErrorCode::PromotionFailed.is_retryable());
        assert!(!InstallErrorCode::ChecksumMismatch.is_retryable());
        assert!(!InstallErrorCode::ArchitectureMismatch.is_retryable());
    }
}
