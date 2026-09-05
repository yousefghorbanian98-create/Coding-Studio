//! Release metadata, Windows architecture mapping, and checksum verification
//! for the pinned Jcode release (ADR-0002).
//!
//! The pinned digest table below is not the trust anchor by itself — the
//! anchor rule is "fetch `SHA256SUMS` from the tag-immutable URL and match,
//! then execute". The table is the recorded observation of that file, proven
//! byte-exact against the GitHub API digest (see
//! `docs/backend-factory/evidence/milestone-one/release-and-license.md`), and
//! it lets tests and the Milestone Two installer cross-check a fetched record
//! against two independent observations of the same immutable release.

use crate::jcode::error::{ErrorCode, JcodeError};
use crate::jcode::version::{PINNED_JCODE_VERSION, PINNED_JCODE_TAG};
use std::fmt;

/// Windows architectures Coding Studio recognizes. Anything else is
/// unsupported (fail closed) — the release assets define the universe.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WindowsArch {
    X86_64,
    AArch64,
}

impl WindowsArch {
    pub fn all() -> &'static [WindowsArch] {
        &[Self::X86_64, Self::AArch64]
    }

    /// Rust target triple upstream builds with.
    pub fn rust_target(self) -> &'static str {
        match self {
            Self::X86_64 => "x86_64-pc-windows-msvc",
            Self::AArch64 => "aarch64-pc-windows-msvc",
        }
    }

    /// Infix upstream uses in asset names.
    pub fn asset_infix(self) -> &'static str {
        match self {
            Self::X86_64 => "windows-x86_64",
            Self::AArch64 => "windows-aarch64",
        }
    }

    /// Single-file executable asset name on the pinned release.
    pub fn exe_asset_name(self) -> String {
        format!("jcode-{}.exe", self.asset_infix())
    }

    /// Tarred asset name on the pinned release.
    pub fn tarball_asset_name(self) -> String {
        format!("jcode-{}.tar.gz", self.asset_infix())
    }

    /// Map a compile-time `std::env::consts::ARCH`-style string. Unknown
    /// architectures are not mappable — fail closed by returning `None`.
    pub fn from_rust_arch(arch: &str) -> Option<Self> {
        match arch {
            "x86_64" => Some(Self::X86_64),
            "aarch64" => Some(Self::AArch64),
            _ => None,
        }
    }
}

/// One parsed checksum line. `digest_hex` is always 64 lowercase hex.
#[derive(Clone, PartialEq, Eq)]
pub struct ChecksumEntry {
    name: String,
    digest_hex: String,
}

impl ChecksumEntry {
    pub fn name(&self) -> &str {
        &self.name
    }
    pub fn digest_hex(&self) -> &str {
        &self.digest_hex
    }
}

// Digest strings are integrity data, not secrets — print fully, but bound
// the name to keep hostile filenames from spraying terminals.
impl fmt::Debug for ChecksumEntry {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "ChecksumEntry {{ name: {}, sha256: {} }}",
            crate::jcode::auth::bounded(&self.name, 96),
            self.digest_hex
        )
    }
}

/// Strictly parsed GNU `sha256sum` record (`<64 hex><two spaces><name>`).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ChecksumSet {
    entries: Vec<ChecksumEntry>,
}

fn is_valid_digest(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

/// Asset names must be bare filenames: no separators, no parent traversals.
fn is_bare_filename(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 128
        && !name.contains('/')
        && !name.contains('\\')
        && name != "."
        && name != ".."
        && !name.contains('\0')
}

impl ChecksumSet {
    /// Parse strictly. Any malformed line fails the whole set (confusion
    /// between a weak and strong record must not be survivable).
    pub fn parse(text: &str) -> Result<Self, JcodeError> {
        let mut entries = Vec::new();
        for (line_no, line) in text.split('\n').enumerate() {
            let line = line.strip_suffix('\r').unwrap_or(line);
            if line.is_empty() {
                continue; // tolerate a trailing newline
            }
            let (digest, name) = line.split_once("  ").ok_or_else(|| {
                JcodeError::new(
                    ErrorCode::ChecksumParseFailed,
                    format!("line {} is not `<sha256>  <name>`", line_no + 1),
                )
            })?;
            if !is_valid_digest(digest) {
                return Err(JcodeError::new(
                    ErrorCode::ChecksumParseFailed,
                    format!("line {} carries an invalid digest", line_no + 1),
                ));
            }
            if name.contains("  ") || !is_bare_filename(name) {
                return Err(JcodeError::new(
                    ErrorCode::ChecksumParseFailed,
                    format!("line {} carries an invalid asset name", line_no + 1),
                ));
            }
            if entries.iter().any(|e: &ChecksumEntry| e.name == name) {
                return Err(JcodeError::new(
                    ErrorCode::ChecksumParseFailed,
                    "duplicate asset name in checksum record",
                ));
            }
            entries.push(ChecksumEntry {
                name: name.to_string(),
                digest_hex: digest.to_string(),
            });
        }
        if entries.is_empty() {
            return Err(JcodeError::new(
                ErrorCode::ChecksumParseFailed,
                "checksum record is empty",
            ));
        }
        Ok(Self { entries })
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Digest for a bare asset name.
    pub fn digest_for(&self, name: &str) -> Option<&str> {
        if !is_bare_filename(name) {
            return None;
        }
        self.entries
            .iter()
            .find(|e| e.name == name)
            .map(|e| e.digest_hex.as_str())
    }
}

/// `(asset name, size in bytes, sha256 hex)` recorded from the official
/// v0.81.7 release (provenance: `fixtures/jcode/PROVENANCE.md`).
pub const EXPECTED_ASSETS_V0_81_7: &[(&str, u64, &str)] = &[
    ("jcode-freebsd-x86_64.tar.gz", 46_175_590, "6cdba698208f45ce2052f37b45fac2a5b901bd6c7b13969b2af3db1ec8fe6f2a"),
    ("jcode-linux-aarch64.tar.gz", 49_358_319, "499b0a877f6d46d1b315a0d11e7ce9f6d8deea36f2f0b0d11d32296dbf9af017"),
    ("jcode-linux-x86_64.tar.gz", 48_303_747, "e75d50fcbf729ed7a96d78e1970c2b10bacf7626e844a3eb7ca2c5f4ccf9590b"),
    ("jcode-macos-aarch64.tar.gz", 50_528_535, "3256d24831ca1c0b3820a03a99d4c782fbc40f740260633dbc6e6a711d47fd7c"),
    ("jcode-macos-x86_64.tar.gz", 53_344_180, "5761f53c2c15aa810f38ed6dfe00597ed75dda808243272e8c963ea5a4ad1d46"),
    ("jcode-windows-aarch64.exe", 80_173_056, "e38ed16c3fb3bae43989c4fe043da7e3240c24bcad95129fad059cf56636c05c"),
    ("jcode-windows-aarch64.tar.gz", 29_475_252, "bda9b2c78569a8c327c204b8735eb62615f208576616964fddcc014ee32fc5a7"),
    ("jcode-windows-x86_64.exe", 128_476_672, "b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b"),
    ("jcode-windows-x86_64.tar.gz", 41_569_887, "5c4ef586311e4cc131f7e311b74a7b7bc9dae8ee5cfd8cf1ab056fa8d19fcb8b"),
];

/// Outcome of validating a fetched checksum record against the pin table.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReleaseVerification {
    pub tag: &'static str,
    pub matched_assets: usize,
    pub windows_arches_covered: Vec<WindowsArch>,
}

/// Cross-check a *fetched* checksum record against the pinned observation.
/// Fails closed on any mismatch: a release whose record disagrees with the
/// independently observed record is treated as substituted and never run.
pub fn verify_against_pin(set: &ChecksumSet) -> Result<ReleaseVerification, JcodeError> {
    for (name, _size, digest) in EXPECTED_ASSETS_V0_81_7 {
        match set.digest_for(name) {
            None => {
                return Err(JcodeError::new(
                    ErrorCode::ReleaseAssetMissing,
                    format!("pinned release {PINNED_JCODE_TAG} must list asset {name}"),
                ));
            }
            Some(found) if found != *digest => {
                return Err(JcodeError::new(
                    ErrorCode::DigestMismatch,
                    format!("asset {name} digest differs from the recorded pin"),
                ));
            }
            _ => {}
        }
    }
    Ok(ReleaseVerification {
        tag: PINNED_JCODE_TAG,
        matched_assets: EXPECTED_ASSETS_V0_81_7.len(),
        windows_arches_covered: WindowsArch::all().to_vec(),
    })
}

/// Tag-specific immutable URLs for one Windows architecture.
pub fn asset_download_url(arch: WindowsArch) -> String {
    format!(
        "{}/{}",
        crate::jcode::version::PINNED_RELEASE_DOWNLOAD_BASE,
        arch.exe_asset_name()
    )
}

/// Current pin's human identity string for diagnostics.
pub fn pinned_release_summary() -> String {
    format!(
        "jcode {PINNED_JCODE_VERSION} ({PINNED_JCODE_TAG} @ {})",
        &crate::jcode::version::PINNED_JCODE_COMMIT[..7]
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_arch_mapping_is_exact() {
        assert_eq!(WindowsArch::X86_64.rust_target(), "x86_64-pc-windows-msvc");
        assert_eq!(WindowsArch::AArch64.rust_target(), "aarch64-pc-windows-msvc");
        assert_eq!(WindowsArch::X86_64.exe_asset_name(), "jcode-windows-x86_64.exe");
        assert_eq!(WindowsArch::AArch64.exe_asset_name(), "jcode-windows-aarch64.exe");
        assert_eq!(WindowsArch::X86_64.tarball_asset_name(), "jcode-windows-x86_64.tar.gz");
        assert_eq!(WindowsArch::AArch64.tarball_asset_name(), "jcode-windows-aarch64.tar.gz");
        assert_eq!(WindowsArch::from_rust_arch("x86_64"), Some(WindowsArch::X86_64));
        assert_eq!(WindowsArch::from_rust_arch("aarch64"), Some(WindowsArch::AArch64));
        assert_eq!(WindowsArch::from_rust_arch("arm"), None);
        assert_eq!(WindowsArch::from_rust_arch("x86"), None);
    }

    #[test]
    fn urls_are_tag_immutable() {
        let url = asset_download_url(WindowsArch::X86_64);
        assert!(url.contains("/download/v0.81.7/jcode-windows-x86_64.exe"));
        assert!(!url.contains("latest"));
        assert_eq!(pinned_release_summary(), "jcode 0.81.7 (v0.81.7 @ 358226c)");
    }

    const SAMPLE: &str = "b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b  jcode-windows-x86_64.exe\n\
                          5c4ef586311e4cc131f7e311b74a7b7bc9dae8ee5cfd8cf1ab056fa8d19fcb8b  jcode-windows-x86_64.tar.gz\n";

    #[test]
    fn checksum_parsing_is_strict_gnu_format() {
        let set = ChecksumSet::parse(SAMPLE).unwrap();
        assert_eq!(set.len(), 2);
        assert_eq!(
            set.digest_for("jcode-windows-x86_64.exe").unwrap(),
            "b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b"
        );
    }

    #[test]
    fn checksum_rejects_malformed_confused_and_hostile_records() {
        for bad in [
            "nothex  file",                                            // bad digest
            "B5B09DBE0DD0B14796DFA75F63DECBDF98A75F3F9DE9B86D6D25522EF3EB105B  x", // uppercase
            "b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b file", // single space
            "b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b  ../evil", // traversal
            "b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b  dir/evil", // separator
            "",                                                        // empty
        ] {
            assert!(ChecksumSet::parse(bad).is_err(), "accepted {bad:?}");
        }
        let dup = format!("{SAMPLE}{SAMPLE}");
        assert!(ChecksumSet::parse(&dup).is_err(), "duplicate names must fail");
    }

    #[test]
    fn digest_for_never_answers_traversal() {
        let set = ChecksumSet::parse(SAMPLE).unwrap();
        assert_eq!(set.digest_for("../jcode-windows-x86_64.exe"), None);
        assert_eq!(set.digest_for("missing.exe"), None);
    }

    #[test]
    fn pin_table_matches_reference_record_shape() {
        // Nine assets were published for v0.81.7; both Windows arches present.
        assert_eq!(EXPECTED_ASSETS_V0_81_7.len(), 9);
        for arch in WindowsArch::all() {
            assert!(EXPECTED_ASSETS_V0_81_7.iter().any(|(n, _, _)| *n == arch.exe_asset_name()));
            assert!(EXPECTED_ASSETS_V0_81_7.iter().any(|(n, _, _)| *n == arch.tarball_asset_name()));
        }
        for (name, size, digest) in EXPECTED_ASSETS_V0_81_7 {
            assert!(is_bare_filename(name));
            assert!(is_valid_digest(digest));
            assert!(*size > 0);
        }
    }

    #[test]
    fn verification_fails_closed_on_substitution() {
        let full = build_full_record();
        let mutated = full.replace(
            "b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b",
            "0000000000000000000000000000000000000000000000000000000000000000",
        );
        let set = ChecksumSet::parse(&mutated).unwrap();
        let err = verify_against_pin(&set).unwrap_err();
        assert_eq!(err.code(), ErrorCode::DigestMismatch);
    }

    #[test]
    fn verification_fails_closed_on_missing_asset() {
        let full = build_full_record();
        let mut lines: Vec<&str> = full.lines().collect();
        lines.truncate(8); // drop the final asset line
        let set = ChecksumSet::parse(&lines.join("\n")).unwrap();
        let err = verify_against_pin(&set).unwrap_err();
        assert_eq!(err.code(), ErrorCode::ReleaseAssetMissing);
    }

    fn build_full_record() -> String {
        let mut out = String::new();
        for (name, _size, digest) in EXPECTED_ASSETS_V0_81_7 {
            out.push_str(digest);
            out.push_str("  ");
            out.push_str(name);
            out.push('\n');
        }
        out
    }

    #[test]
    fn verification_passes_on_recorded_record() {
        let set = ChecksumSet::parse(&build_full_record()).unwrap();
        let v = verify_against_pin(&set).unwrap();
        assert_eq!(v.tag, "v0.81.7");
        assert_eq!(v.matched_assets, 9);
        assert_eq!(v.windows_arches_covered.len(), 2);
    }
}
