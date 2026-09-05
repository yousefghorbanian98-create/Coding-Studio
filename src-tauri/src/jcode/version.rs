//! Pinned Jcode version policy and compatibility classification.
//!
//! ADR-0002: Coding Studio supports exactly the pinned release. Older
//! versions are unsupported; newer versions are *unknown* — never assumed
//! compatible. All non-supported outcomes fail closed with an actionable
//! error (see `require_supported`).

use crate::jcode::error::{ErrorCode, JcodeError};
use serde::Deserialize;
use std::fmt;

/// The only verified upstream repository.
pub const PINNED_JCODE_REPO: &str = "https://github.com/1jehuang/jcode";
/// Pinned product version (semver without the `v` prefix).
pub const PINNED_JCODE_VERSION: &str = "0.81.7";
/// Pinned annotated git tag.
pub const PINNED_JCODE_TAG: &str = "v0.81.7";
/// Commit the pinned tag dereferences to (verified ancestor of `master`).
pub const PINNED_JCODE_COMMIT: &str = "358226c2a35b8b50d4d520b3363b0dc60c000fdb";
/// Tag-specific immutable download base (never a "latest" URL).
pub const PINNED_RELEASE_DOWNLOAD_BASE: &str =
    "https://github.com/1jehuang/jcode/releases/download/v0.81.7";
/// Immutable official checksum record for the pinned release.
pub const PINNED_CHECKSUMS_URL: &str =
    "https://github.com/1jehuang/jcode/releases/download/v0.81.7/SHA256SUMS";
/// GitHub API digest of the official `SHA256SUMS` file itself, recorded from
/// an independent channel (`repos/1jehuang/jcode/releases/tags/v0.81.7`).
pub const PINNED_CHECKSUMS_FILE_SHA256: &str =
    "733aebe30981a81c5d8205ac76b6d57399e4fbd4dc77ec1b371478dfe68cce0e";

/// Strict `major.minor.patch`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct SemVer {
    pub major: u32,
    pub minor: u32,
    pub patch: u32,
}

impl SemVer {
    /// Parse `x.y.z` (optional leading `v`). No prerelease/build metadata is
    /// accepted: upstream releases are plain `vX.Y.Z` tags.
    pub fn parse(raw: &str) -> Result<Self, JcodeError> {
        let trimmed = raw.trim().strip_prefix('v').unwrap_or(raw.trim()).trim();
        let mut parts = trimmed.split('.');
        let mut next = |label: &str| -> Result<u32, JcodeError> {
            let part = parts.next().ok_or_else(|| {
                JcodeError::new(
                    ErrorCode::MalformedVersionReport,
                    format!("version string is missing its {label} component"),
                )
            })?;
            if part.is_empty() || part.len() > 9 || !part.bytes().all(|b| b.is_ascii_digit()) {
                return Err(JcodeError::new(
                    ErrorCode::MalformedVersionReport,
                    format!("version {label} component is not a short integer"),
                ));
            }
            part.parse::<u32>().map_err(|_| {
                JcodeError::new(ErrorCode::MalformedVersionReport, "version component overflow")
            })
        };
        let major = next("major")?;
        let minor = next("minor")?;
        let patch = next("patch")?;
        if parts.next().is_some() {
            return Err(JcodeError::new(
                ErrorCode::MalformedVersionReport,
                "version string has more than three components",
            ));
        }
        Ok(Self { major, minor, patch })
    }

    pub fn pinned() -> Self {
        // Compile-time invariant: the pin must parse. Panics only if the
        // constants are edited incorrectly, which the unit tests pin down.
        Self::parse(PINNED_JCODE_VERSION).expect("pinned version must parse")
    }
}

impl fmt::Display for SemVer {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

/// Subset of `jcode version --json` (`VersionReport` upstream). Every field
/// is optional on the way in; classification decides what it needs.
#[derive(Debug, Clone, Deserialize, Default, PartialEq, Eq)]
pub struct VersionReport {
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub semver: Option<String>,
    #[serde(default)]
    pub base_semver: Option<String>,
    #[serde(default)]
    pub update_semver: Option<String>,
    #[serde(default)]
    pub git_hash: Option<String>,
    #[serde(default)]
    pub git_tag: Option<String>,
    #[serde(default)]
    pub build_time: Option<String>,
    #[serde(default)]
    pub git_date: Option<String>,
    #[serde(default)]
    pub release_build: Option<bool>,
}

/// How an observed Jcode build relates to the pin.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VersionCompatibility {
    /// Exactly the pinned release.
    Supported,
    /// Older than the pin: known-unsupported.
    UnsupportedOlder,
    /// Newer than the pin: not yet verified, must not be assumed compatible.
    UnknownNewer,
    /// Unparseable or self-contradictory report.
    Malformed,
}

impl VersionCompatibility {
    pub fn is_supported(self) -> bool {
        matches!(self, Self::Supported)
    }
}

/// Parse a raw `jcode version --json` payload.
pub fn parse_version_report(json: &str) -> Result<VersionReport, JcodeError> {
    serde_json::from_str::<VersionReport>(json).map_err(|e| {
        JcodeError::new(
            ErrorCode::MalformedVersionReport,
            format!("version report is not the documented JSON shape ({e})"),
        )
    })
}

/// Classify a parsed report. Decision rules (in order):
/// `semver` (falling back to `version`) parses → compare to the pin →
/// equal: supported; less: unsupported-older; greater: unknown-newer.
/// An optional `git_tag` that disagrees with the pin downgrades to
/// `Malformed`, because a tag/semver contradiction is noise, not evidence.
pub fn classify(report: &VersionReport) -> VersionCompatibility {
    let raw = report
        .semver
        .as_deref()
        .or(report.version.as_deref())
        .unwrap_or("");
    let parsed = match SemVer::parse(raw) {
        Ok(v) => v,
        Err(_) => return VersionCompatibility::Malformed,
    };
    if let Some(tag) = report.git_tag.as_deref() {
        let tag_is_pin = tag.trim() == PINNED_JCODE_TAG;
        if parsed == SemVer::pinned() && !tag_is_pin {
            return VersionCompatibility::Malformed;
        }
    }
    match parsed.cmp(&SemVer::pinned()) {
        std::cmp::Ordering::Equal => VersionCompatibility::Supported,
        std::cmp::Ordering::Less => VersionCompatibility::UnsupportedOlder,
        std::cmp::Ordering::Greater => VersionCompatibility::UnknownNewer,
    }
}

/// Fail-closed gate used before any Jcode process is trusted.
pub fn require_supported(report: &VersionReport) -> Result<(), JcodeError> {
    let report_version = report
        .semver
        .clone()
        .or_else(|| report.version.clone())
        .unwrap_or_else(|| "<unreported>".to_string());
    match classify(report) {
        VersionCompatibility::Supported => Ok(()),
        VersionCompatibility::UnsupportedOlder => Err(JcodeError::new(
            ErrorCode::UnsupportedJcodeVersion,
            format!(
                "installed Jcode {report_version} is older than supported {PINNED_JCODE_VERSION}; \
                 install {PINNED_JCODE_TAG} from {PINNED_JCODE_REPO}/releases"
            ),
        )),
        VersionCompatibility::UnknownNewer => Err(JcodeError::new(
            ErrorCode::UnknownNewerJcodeVersion,
            format!(
                "installed Jcode {report_version} is newer than verified {PINNED_JCODE_VERSION}; \
                 newer releases are never assumed compatible — wait for Coding Studio to verify \
                 and pin {report_version}, or install {PINNED_JCODE_TAG}"
            ),
        )),
        VersionCompatibility::Malformed => Err(JcodeError::new(
            ErrorCode::MalformedVersionReport,
            "jcode version output did not classify; refusing to trust an unverifiable build",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pin_block_is_exactly_v0_81_7() {
        assert_eq!(PINNED_JCODE_VERSION, "0.81.7");
        assert_eq!(PINNED_JCODE_TAG, "v0.81.7");
        assert_eq!(PINNED_JCODE_COMMIT.len(), 40);
        assert!(PINNED_JCODE_COMMIT.chars().all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
        assert!(PINNED_CHECKSUMS_URL.contains("/download/v0.81.7/"));
        assert!(!PINNED_CHECKSUMS_URL.contains("latest"), "mutable URL forbidden");
        assert_eq!(SemVer::pinned(), SemVer { major: 0, minor: 81, patch: 7 });
    }

    #[test]
    fn semver_parsing_is_strict() {
        assert_eq!(
            SemVer::parse("1.2.3").unwrap(),
            SemVer { major: 1, minor: 2, patch: 3 }
        );
        assert_eq!(
            SemVer::parse("v0.81.7").unwrap(),
            SemVer { major: 0, minor: 81, patch: 7 }
        );
        for bad in ["", "1", "1.2", "1.2.3.4", "1.2.x", "v", "9999999999.0.0", "0.81.7-rc1"] {
            assert!(SemVer::parse(bad).is_err(), "accepted {bad:?}");
        }
    }

    fn report(semver: &str, tag: Option<&str>) -> VersionReport {
        VersionReport {
            version: Some(semver.to_string()),
            semver: Some(semver.to_string()),
            base_semver: Some(semver.to_string()),
            update_semver: Some(semver.to_string()),
            git_hash: Some(PINNED_JCODE_COMMIT[..7].to_string()),
            git_tag: tag.map(str::to_string),
            build_time: Some("2026-09-04T20:00:00Z".to_string()),
            git_date: Some("2026-09-04".to_string()),
            release_build: Some(true),
        }
    }

    #[test]
    fn pinned_release_classifies_supported() {
        assert_eq!(classify(&report("0.81.7", Some("v0.81.7"))), VersionCompatibility::Supported);
        assert!(require_supported(&report("0.81.7", Some("v0.81.7"))).is_ok());
    }

    #[test]
    fn older_release_fails_closed() {
        let r = report("0.80.1", Some("v0.80.1"));
        assert_eq!(classify(&r), VersionCompatibility::UnsupportedOlder);
        let err = require_supported(&r).unwrap_err();
        assert_eq!(err.code(), ErrorCode::UnsupportedJcodeVersion);
        assert!(err.to_string().contains("0.81.7"), "actionable: {err}");
    }

    #[test]
    fn newer_release_is_unknown_not_supported() {
        let r = report("0.82.0", Some("v0.82.0"));
        assert_eq!(classify(&r), VersionCompatibility::UnknownNewer);
        let err = require_supported(&r).unwrap_err();
        assert_eq!(err.code(), ErrorCode::UnknownNewerJcodeVersion);
        assert!(err.to_string().contains("never assumed compatible"));
        // The abandoned 0.9.x line is genuinely older in semver order
        // (9 < 81), so it classifies as unsupported-older, never "newer".
        assert_eq!(
            classify(&report("0.9.8", Some("v0.9.8"))),
            VersionCompatibility::UnsupportedOlder
        );
    }

    #[test]
    fn malformed_and_contradictory_reports_fail_closed() {
        assert_eq!(classify(&VersionReport::default()), VersionCompatibility::Malformed);
        assert_eq!(classify(&report("not-a-version", None)), VersionCompatibility::Malformed);
        // semver says pinned but tag disagrees: contradiction, not evidence.
        assert_eq!(classify(&report("0.81.7", Some("v0.81.6"))), VersionCompatibility::Malformed);
        assert!(require_supported(&report("banana", None)).is_err());
    }

    #[test]
    fn parse_version_report_tolerates_missing_optional_fields() {
        let r = parse_version_report(r#"{"semver":"0.81.7","git_tag":"v0.81.7"}"#).unwrap();
        assert_eq!(classify(&r), VersionCompatibility::Supported);
        assert!(parse_version_report("not json").is_err());
        assert!(parse_version_report("[1,2,3]").is_err());
    }
}
