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
/// Official short (seven-character) form of the pinned commit, as emitted
/// by `jcode version --json` (`git_hash`).
pub const PINNED_JCODE_SHORT_HASH: &str = "358226c";
/// Version-scoped download base for the pinned release.
///
/// Precision note (review round 1): this URL is version-scoped, **not** an
/// immutable trust anchor. GitHub release assets and tags can be replaced or
/// re-pointed server-side. The immutable Coding Studio trust anchor is the
/// embedded SHA-256 digest table (`verification.rs`); any asset replacement
/// or tag movement must fail that pinned digest check before execution.
pub const PINNED_RELEASE_DOWNLOAD_BASE: &str =
    "https://github.com/1jehuang/jcode/releases/download/v0.81.7";
/// Version-scoped URL of the official checksum record for the pinned
/// release — fetched to satisfy the embedded-freshness requirement only and
/// cross-checked against `PINNED_CHECKSUMS_FILE_SHA256` before any trust
/// decision; the URL itself is not a trust anchor (see above).
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
                JcodeError::new(
                    ErrorCode::MalformedVersionReport,
                    "version component overflow",
                )
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
        Ok(Self {
            major,
            minor,
            patch,
        })
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
///
/// 1. `semver` (falling back to `version`) must parse — otherwise
///    [`VersionCompatibility::Malformed`].
/// 2. Ordering against the pin decides the lane: older is
///    `UnsupportedOlder`, newer is `UnknownNewer` — lanes are retained even
///    if extra identity fields are present, because ordering evidence is
///    what those lanes mean.
/// 3. Exactly-on-pin reports classify as `Supported` **only when every
///    required identity claim agrees** (review round 1, finding 1):
///    - `semver` equals `0.81.7`;
///    - `version`, when present, parses and agrees with `semver`;
///    - `git_tag` is present and equals `v0.81.7`;
///    - `git_hash` is present and equals the official seven-character
///      release hash `358226c` or the full pinned commit
///      `358226c2a35b8b50d4d520b3363b0dc60c000fdb`;
///    - `release_build` is exactly `true`.
///
///    Any missing or contradictory identity field fails closed as
///    `Malformed`. Contradictory identity metadata is never accepted as
///    `Supported`. `build_time`/`git_date` are decorative and never part of
///    the trust decision.
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
    match parsed.cmp(&SemVer::pinned()) {
        std::cmp::Ordering::Less => VersionCompatibility::UnsupportedOlder,
        std::cmp::Ordering::Greater => VersionCompatibility::UnknownNewer,
        std::cmp::Ordering::Equal => pinned_identity(report, parsed),
    }
}

/// Strict identity gate for exactly-on-pin reports (see [`classify`]).
fn pinned_identity(report: &VersionReport, parsed: SemVer) -> VersionCompatibility {
    // A present `version` must agree with `semver`.
    if let Some(v) = report.version.as_deref() {
        match SemVer::parse(v) {
            Ok(pv) if pv == parsed => {}
            _ => return VersionCompatibility::Malformed,
        }
    }
    // `git_tag` is required and must equal the pin.
    if report.git_tag.as_deref().map(str::trim) != Some(PINNED_JCODE_TAG) {
        return VersionCompatibility::Malformed;
    }
    // `git_hash` is required: official short form or the exact full pin.
    let hash_ok = report
        .git_hash
        .as_deref()
        .map(str::trim)
        .map(|h| h == PINNED_JCODE_SHORT_HASH || h == PINNED_JCODE_COMMIT)
        .unwrap_or(false);
    if !hash_ok {
        return VersionCompatibility::Malformed;
    }
    // `release_build` must be exactly true (missing counts as malformed).
    if report.release_build != Some(true) {
        return VersionCompatibility::Malformed;
    }
    VersionCompatibility::Supported
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
        assert!(PINNED_JCODE_COMMIT
            .chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase()));
        assert!(PINNED_CHECKSUMS_URL.contains("/download/v0.81.7/"));
        assert!(
            !PINNED_CHECKSUMS_URL.contains("latest"),
            "mutable URL forbidden"
        );
        assert_eq!(
            SemVer::pinned(),
            SemVer {
                major: 0,
                minor: 81,
                patch: 7
            }
        );
    }

    #[test]
    fn semver_parsing_is_strict() {
        assert_eq!(
            SemVer::parse("1.2.3").unwrap(),
            SemVer {
                major: 1,
                minor: 2,
                patch: 3
            }
        );
        assert_eq!(
            SemVer::parse("v0.81.7").unwrap(),
            SemVer {
                major: 0,
                minor: 81,
                patch: 7
            }
        );
        for bad in [
            "",
            "1",
            "1.2",
            "1.2.3.4",
            "1.2.x",
            "v",
            "9999999999.0.0",
            "0.81.7-rc1",
        ] {
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
        assert_eq!(
            classify(&report("0.81.7", Some("v0.81.7"))),
            VersionCompatibility::Supported
        );
        assert!(require_supported(&report("0.81.7", Some("v0.81.7"))).is_ok());
    }

    // ---- Review round 1, finding 1: strict pinned-identity gate ----------

    /// Complete official pinned report (all identity fields present and
    /// agreeing) is the ONLY shape that classifies Supported.
    #[test]
    fn complete_official_pinned_report_is_supported() {
        let mut r = report("0.81.7", Some("v0.81.7"));
        r.git_hash = Some(PINNED_JCODE_COMMIT.to_string());
        r.build_time = None;
        r.git_date = None;
        assert_eq!(classify(&r), VersionCompatibility::Supported);
    }

    #[test]
    fn missing_git_tag_fails_closed_as_malformed() {
        let mut r = report("0.81.7", None);
        assert_eq!(classify(&r), VersionCompatibility::Malformed);
        r.git_tag = Some("v0.81.7".to_string());
        assert_eq!(classify(&r), VersionCompatibility::Supported);
    }

    #[test]
    fn missing_or_wrong_git_hash_fails_closed_as_malformed() {
        let mut r = report("0.81.7", Some("v0.81.7"));
        r.git_hash = None;
        assert_eq!(classify(&r), VersionCompatibility::Malformed);
        r.git_hash = Some("0000000".to_string());
        assert_eq!(classify(&r), VersionCompatibility::Malformed);
        r.git_hash = Some("9".repeat(40));
        assert_eq!(classify(&r), VersionCompatibility::Malformed);
    }

    #[test]
    fn official_short_and_exact_full_hash_are_accepted() {
        let mut r = report("0.81.7", Some("v0.81.7"));
        r.git_hash = Some(PINNED_JCODE_SHORT_HASH.to_string());
        assert_eq!(classify(&r), VersionCompatibility::Supported);
        r.git_hash = Some(PINNED_JCODE_COMMIT.to_string());
        assert_eq!(classify(&r), VersionCompatibility::Supported);
    }

    #[test]
    fn release_build_must_be_exactly_true() {
        let mut r = report("0.81.7", Some("v0.81.7"));
        r.release_build = None;
        assert_eq!(classify(&r), VersionCompatibility::Malformed);
        r.release_build = Some(false);
        assert_eq!(classify(&r), VersionCompatibility::Malformed);
        r.release_build = Some(true);
        assert_eq!(classify(&r), VersionCompatibility::Supported);
    }

    #[test]
    fn version_semver_disagreement_fails_closed_as_malformed() {
        let mut r = report("0.81.7", Some("v0.81.7"));
        r.version = Some("0.81.6".to_string());
        assert_eq!(classify(&r), VersionCompatibility::Malformed);
        let mut r = report("0.81.7", Some("v0.81.7"));
        r.version = Some("not-a-version".to_string());
        assert_eq!(classify(&r), VersionCompatibility::Malformed);
    }

    #[test]
    fn older_and_newer_lanes_hold_even_with_full_identity_metadata() {
        let mut older = report("0.80.1", Some("v0.80.1"));
        older.release_build = Some(true);
        assert_eq!(classify(&older), VersionCompatibility::UnsupportedOlder);
        let mut newer = report("0.82.0", Some("v0.82.0"));
        newer.release_build = Some(true);
        assert_eq!(classify(&newer), VersionCompatibility::UnknownNewer);
        // And contradictory metadata can never flip them into Supported.
        let mut sneaky = report("0.82.0", Some("v0.81.7"));
        sneaky.git_hash = Some(PINNED_JCODE_COMMIT.to_string());
        assert_eq!(classify(&sneaky), VersionCompatibility::UnknownNewer);
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
        assert_eq!(
            classify(&VersionReport::default()),
            VersionCompatibility::Malformed
        );
        assert_eq!(
            classify(&report("not-a-version", None)),
            VersionCompatibility::Malformed
        );
        // semver says pinned but tag disagrees: contradiction, not evidence.
        assert_eq!(
            classify(&report("0.81.7", Some("v0.81.6"))),
            VersionCompatibility::Malformed
        );
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
