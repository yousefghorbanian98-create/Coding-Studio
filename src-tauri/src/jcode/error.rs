//! Stable Coding Studio error codes for the Jcode compatibility boundary.
//!
//! Codes are part of the product contract: they never change meaning once
//! assigned, so the future IPC layer (Milestone Three) can surface them and
//! support tooling can pattern-match them. Every message is redacted and
//! length-capped before it is stored, so an `Err` can never carry a secret.

use crate::jcode::auth::{bounded, redact};
use crate::jcode::impl_debug_via_display;
use std::fmt;

/// Stable machine-readable codes. Numeric ranges:
/// `E10xx` version policy, `E11xx` wire/framing, `E12xx` identifiers,
/// `E13xx` release/checksum verification, `E14xx` capabilities/policy,
/// `E15xx` configuration, `E19xx` internal.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorCode {
    /// Installed Jcode is older than the pinned supported release.
    UnsupportedJcodeVersion,
    /// Installed Jcode is newer than the pinned supported release: unknown,
    /// therefore fail closed (never assume compatibility).
    UnknownNewerJcodeVersion,
    /// `jcode version --json` output could not be parsed or classified.
    MalformedVersionReport,
    /// Peer speaks a protocol major we do not implement.
    ProtocolVersionUnsupported,
    /// Frame exceeded `MAX_FRAME_BYTES` without a newline terminator.
    FrameTooLarge,
    /// Frame contained control bytes / terminal output, invalid UTF-8, or
    /// non-object JSON.
    MalformedFrame,
    /// JSON parsed but a field the contract requires was missing or mistyped.
    MissingRequiredField,
    /// Session/tool-call/permission identifier failed validation.
    InvalidIdentifier,
    /// I/O on the underlying reader/writer failed.
    ProtocolIo,
    /// SHA256SUMS-style content failed strict parsing.
    ChecksumParseFailed,
    /// An expected release asset is absent from the checksum record.
    ReleaseAssetMissing,
    /// A computed digest does not match the pinned record.
    DigestMismatch,
    /// Attempted to use a capability that is unsupported or unknown.
    CapabilityDenied,
    /// A local-model/Ollama surface tried to enter the product contract.
    LocalRuntimeDenied,
    /// Approval resolution referenced a request id this boundary never saw.
    ApprovalNotOutstanding,
    /// Configuration path failed validation (traversal, relative, empty).
    ConfigPathInvalid,
    /// Payload exceeded a product limit (e.g. outbound prompt cap).
    PayloadTooLarge,
    /// Catch-all for defects in this layer itself.
    Internal,
}

impl ErrorCode {
    /// Stable `JCODE-Exxxx` spelling.
    pub fn code(self) -> &'static str {
        match self {
            Self::UnsupportedJcodeVersion => "JCODE-E1001",
            Self::UnknownNewerJcodeVersion => "JCODE-E1002",
            Self::MalformedVersionReport => "JCODE-E1003",
            Self::ProtocolVersionUnsupported => "JCODE-E1004",
            Self::FrameTooLarge => "JCODE-E1101",
            Self::MalformedFrame => "JCODE-E1102",
            Self::MissingRequiredField => "JCODE-E1103",
            Self::InvalidIdentifier => "JCODE-E1201",
            Self::ProtocolIo => "JCODE-E1104",
            Self::ChecksumParseFailed => "JCODE-E1301",
            Self::ReleaseAssetMissing => "JCODE-E1302",
            Self::DigestMismatch => "JCODE-E1303",
            Self::CapabilityDenied => "JCODE-E1401",
            Self::LocalRuntimeDenied => "JCODE-E1402",
            Self::ApprovalNotOutstanding => "JCODE-E1403",
            Self::ConfigPathInvalid => "JCODE-E1501",
            Self::PayloadTooLarge => "JCODE-E1105",
            Self::Internal => "JCODE-E1900",
        }
    }

    /// One-line human summary, free of dynamic content.
    pub fn summary(self) -> &'static str {
        match self {
            Self::UnsupportedJcodeVersion => "unsupported Jcode version",
            Self::UnknownNewerJcodeVersion => "unverified newer Jcode version",
            Self::MalformedVersionReport => "unparseable Jcode version report",
            Self::ProtocolVersionUnsupported => "unsupported harness protocol major",
            Self::FrameTooLarge => "frame exceeds the bounded size limit",
            Self::MalformedFrame => "malformed protocol frame",
            Self::MissingRequiredField => "frame missing a required field",
            Self::InvalidIdentifier => "invalid protocol identifier",
            Self::ProtocolIo => "protocol channel I/O error",
            Self::ChecksumParseFailed => "checksum record failed strict parsing",
            Self::ReleaseAssetMissing => "expected release asset missing",
            Self::DigestMismatch => "release asset digest mismatch",
            Self::CapabilityDenied => "capability is not supported",
            Self::LocalRuntimeDenied => "local model runtimes are denied",
            Self::ApprovalNotOutstanding => "approval id is not outstanding",
            Self::ConfigPathInvalid => "configuration path is invalid",
            Self::PayloadTooLarge => "payload exceeds the bounded limit",
            Self::Internal => "internal compatibility-layer fault",
        }
    }
}

/// Redacted, length-capped, coded error for the compatibility boundary.
pub struct JcodeError {
    code: ErrorCode,
    message: String,
}

/// Maximum length of any stored error message.
pub const MAX_ERROR_MESSAGE: usize = 240;

impl JcodeError {
    /// Build an error; the detail string is redacted and capped on the way in.
    pub fn new(code: ErrorCode, detail: impl AsRef<str>) -> Self {
        Self {
            code,
            message: bounded(&redact(detail.as_ref()), MAX_ERROR_MESSAGE),
        }
    }

    pub fn code(&self) -> ErrorCode {
        self.code
    }

    /// Redacted detail text (no secrets, no control characters).
    pub fn message(&self) -> &str {
        &self.message
    }
}

impl fmt::Display for JcodeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} {}: {}", self.code.code(), self.code.summary(), self.message)
    }
}

// Debug intentionally mirrors Display: printing must never leak un-redacted
// detail.
impl fmt::Debug for JcodeError {
    impl_debug_via_display!();
}

impl std::error::Error for JcodeError {}

impl From<std::io::Error> for JcodeError {
    fn from(err: std::io::Error) -> Self {
        JcodeError::new(ErrorCode::ProtocolIo, err.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codes_are_stable_strings() {
        assert_eq!(ErrorCode::FrameTooLarge.code(), "JCODE-E1101");
        assert_eq!(ErrorCode::LocalRuntimeDenied.code(), "JCODE-E1402");
        assert_eq!(ErrorCode::ProtocolVersionUnsupported.code(), "JCODE-E1004");
    }

    #[test]
    fn messages_are_redacted_and_capped() {
        let secret = format!("token=sk-{}", "A".repeat(400));
        let err = JcodeError::new(ErrorCode::Internal, secret);
        let shown = err.to_string();
        assert!(!shown.contains("sk-"), "secret shape must be redacted: {shown}");
        assert!(shown.len() < 400, "message must be capped");
        assert!(shown.contains("[REDACTED]"), "redaction marker expected");
    }

    #[test]
    fn display_includes_code_and_summary() {
        let err = JcodeError::new(ErrorCode::CapabilityDenied, "memory");
        let s = err.to_string();
        assert!(s.starts_with("JCODE-E1401 capability is not supported: "));
    }

    #[test]
    fn io_errors_convert_without_detail_leak() {
        let io = std::io::Error::new(std::io::ErrorKind::BrokenPipe, "pipe to /tmp/secret-path-many-words");
        let err: JcodeError = io.into();
        assert_eq!(err.code(), ErrorCode::ProtocolIo);
        assert!(err.to_string().len() < 400);
    }
}
