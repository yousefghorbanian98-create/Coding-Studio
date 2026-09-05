//! Configuration and filesystem location representation for Jcode
//! integration (ADR-0001 boundary data only — this module reads environment
//! through an injected getter and never touches the disk in Milestone One).
//!
//! Mirrors the upstream resolution order (evidence:
//! `crates/jcode-harness-api/src/sockets.rs`,
//! `crates/jcode-sdk/src/launch.rs` `user_jcode_home`, `docs/WINDOWS.md`):
//!
//! - user home: `JCODE_HOME` → else `%USERPROFILE%\.jcode`
//! - install root: `%LOCALAPPDATA%\jcode` (bin/, builds/stable/, builds/versions/<v>/)
//! - runtime dir: `JCODE_RUNTIME_DIR` → else `%TEMP%\jcode-<sanitized USERNAME>`
//! - sockets: `jcode-api.sock` / `jcode.sock` inside runtime dir
//!   (`JCODE_API_SOCKET` / `JCODE_SOCKET` overrides)
//! - Windows transport: named pipe `\\.\pipe\<stem>-<sha256(path)[..16]>`
//!   (`crates/jcode-transport/src/windows.rs` algorithm, re-implemented).

use crate::jcode::auth::bounded;
use crate::jcode::error::{ErrorCode, JcodeError};
use sha2::Digest;
use std::fmt;

/// All validated, non-secret filesystem locations for the Jcode integration.
/// Constructed only through [`JcodePaths::resolve_for_windows`] or
/// [`JcodePaths::from_env`]; fields contain no user profiles' contents, only
/// paths.
#[derive(Clone, PartialEq, Eq)]
pub struct JcodePaths {
    /// `%USERPROFILE%\.jcode` (or `JCODE_HOME`).
    pub user_home: String,
    /// `%LOCALAPPDATA%\jcode`.
    pub install_root: String,
    /// `%LOCALAPPDATA%\jcode\bin` — the launcher directory on PATH.
    pub bin_dir: String,
    /// Versioned binary directory for the pinned release.
    pub pinned_version_dir: String,
    /// `%TEMP%\jcode-<user>` (or `JCODE_RUNTIME_DIR`).
    pub runtime_dir: String,
    /// Harness API socket path (`jcode-api.sock` in runtime dir).
    pub api_socket: String,
    /// Internal daemon socket path (`jcode.sock` in runtime dir).
    pub legacy_socket: String,
}

// Paths are diagnostics data: print bounded; nothing secret can live inside
// them by construction, but bound for terminal safety anyway.
impl fmt::Debug for JcodePaths {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("JcodePaths")
            .field("user_home", &bounded(&self.user_home, 96))
            .field("install_root", &bounded(&self.install_root, 96))
            .field("runtime_dir", &bounded(&self.runtime_dir, 96))
            .field("api_socket", &bounded(&self.api_socket, 96))
            .finish()
    }
}

/// Read an environment variable; injected so tests never depend on the host.
pub trait EnvGet {
    fn get(&self, key: &str) -> Option<String>;
}

/// The real process environment.
pub struct ProcessEnv;

impl EnvGet for ProcessEnv {
    fn get(&self, key: &str) -> Option<String> {
        std::env::var(key).ok().filter(|v| !v.is_empty())
    }
}

/// Reject anything that is not a rooted path or contains traversal/hazards.
/// `v` is expected to be Windows-shaped (`C:\…`, `C:/…` or UNC `\\host\…`).
fn validate_absolute_path(v: &str, label: &str) -> Result<String, JcodeError> {
    let trimmed = v.trim();
    if trimmed.is_empty() || trimmed.len() > 512 {
        return Err(JcodeError::new(ErrorCode::ConfigPathInvalid, format!("{label} is empty or oversized")));
    }
    let bytes = trimmed.as_bytes();
    let rooted_drive = bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/');
    let rooted_unc = trimmed.starts_with("\\\\") || trimmed.starts_with("//");
    let rooted_unix = trimmed.starts_with('/'); // tolerated for tests on Unix sandboxes
    if !(rooted_drive || rooted_unc || rooted_unix) {
        return Err(JcodeError::new(
            ErrorCode::ConfigPathInvalid,
            format!("{label} is not an absolute path"),
        ));
    }
    if trimmed.split(['/', '\\']).any(|seg| seg == "..") {
        return Err(JcodeError::new(
            ErrorCode::ConfigPathInvalid,
            format!("{label} contains a parent traversal segment"),
        ));
    }
    if trimmed.bytes().any(|b| b < 0x20 || b == 0x7f) {
        return Err(JcodeError::new(
            ErrorCode::ConfigPathInvalid,
            format!("{label} contains control characters"),
        ));
    }
    Ok(trimmed.to_string())
}

/// Upstream `sanitize` (`sockets.rs`): alnum/`-`/`_`, max 64 chars,
/// "user" fallback.
fn sanitize_user(raw: &str) -> String {
    let out: String = raw
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(*ch, '-' | '_'))
        .take(64)
        .collect();
    if out.is_empty() { "user".to_string() } else { out }
}

fn join_win(base: &str, leaf: &str) -> String {
    let sep = if base.ends_with('\\') || base.ends_with('/') { "" } else { "\\" };
    format!("{base}{sep}{leaf}")
}

impl JcodePaths {
    /// Resolve from a provided environment getter (pure; no disk access).
    pub fn resolve_with_env(env: &dyn EnvGet) -> Result<Self, JcodeError> {
        let user_home = match env.get("JCODE_HOME") {
            Some(v) => validate_absolute_path(&v, "JCODE_HOME")?,
            None => {
                let profile = env
                    .get("USERPROFILE")
                    .ok_or_else(|| JcodeError::new(ErrorCode::ConfigPathInvalid, "USERPROFILE is not set"))?;
                let profile = validate_absolute_path(&profile, "USERPROFILE")?;
                join_win(&profile, ".jcode")
            }
        };
        let install_root = {
            let local = env
                .get("LOCALAPPDATA")
                .ok_or_else(|| JcodeError::new(ErrorCode::ConfigPathInvalid, "LOCALAPPDATA is not set"))?;
            join_win(&validate_absolute_path(&local, "LOCALAPPDATA")?, "jcode")
        };
        let runtime_dir = match env.get("JCODE_RUNTIME_DIR") {
            Some(v) => validate_absolute_path(&v, "JCODE_RUNTIME_DIR")?,
            None => {
                let temp = env
                    .get("TEMP")
                    .or_else(|| env.get("TMP"))
                    .ok_or_else(|| JcodeError::new(ErrorCode::ConfigPathInvalid, "TEMP is not set"))?;
                let temp = validate_absolute_path(&temp, "TEMP")?;
                let user = sanitize_user(&env.get("USERNAME").unwrap_or_else(|| "user".to_string()));
                join_win(&temp, &format!("jcode-{user}"))
            }
        };
        let api_socket = match env.get("JCODE_API_SOCKET") {
            Some(v) => validate_absolute_path(&v, "JCODE_API_SOCKET")?,
            None => join_win(&runtime_dir, "jcode-api.sock"),
        };
        let legacy_socket = match env.get("JCODE_SOCKET") {
            Some(v) => validate_absolute_path(&v, "JCODE_SOCKET")?,
            None => join_win(&runtime_dir, "jcode.sock"),
        };
        Ok(Self {
            user_home,
            pinned_version_dir: join_win(
                &join_win(&join_win(&install_root, "builds"), "versions"),
                crate::jcode::version::PINNED_JCODE_VERSION,
            ),
            bin_dir: join_win(&install_root, "bin"),
            install_root,
            runtime_dir,
            api_socket,
            legacy_socket,
        })
    }

    /// Resolve from the live process environment.
    pub fn from_env() -> Result<Self, JcodeError> {
        Self::resolve_with_env(&ProcessEnv)
    }
}

/// Upstream pipe-name derivation
/// (`crates/jcode-transport/src/windows.rs::path_to_pipe_name`):
/// `\\.\pipe\<stem>-<first 16 hex of sha256(lowercased, '/'-normalized path)>`.
/// The stem is the file stem sanitized to `[A-Za-z0-9-_]`, max 32 chars,
/// `jcode` fallback.
pub fn windows_pipe_name(socket_path: &str) -> String {
    let normalized = socket_path.replace('\\', "/").to_ascii_lowercase();
    let stem_raw = normalized.rsplit('/').next().unwrap_or("jcode");
    let stem_raw = stem_raw.strip_suffix(".sock").unwrap_or(stem_raw);
    let stem: String = stem_raw
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || matches!(*ch, '-' | '_'))
        .take(32)
        .collect();
    let stem = if stem.is_empty() { "jcode" } else { stem.as_str() };
    let digest = sha2::Sha256::digest(normalized.as_bytes());
    let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
    format!(r"\\.\pipe\{stem}-{}", &hex[..16])
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    struct FakeEnv(HashMap<&'static str, String>);
    impl EnvGet for FakeEnv {
        fn get(&self, key: &str) -> Option<String> {
            self.0.get(key).cloned()
        }
    }

    fn standard_env() -> FakeEnv {
        FakeEnv(HashMap::from([
            ("USERPROFILE", r"C:\Users\Amina".to_string()),
            ("LOCALAPPDATA", r"C:\Users\Amina\AppData\Local".to_string()),
            ("TEMP", r"C:\Users\Amina\AppData\Local\Temp".to_string()),
            ("USERNAME", "Amina".to_string()),
        ]))
    }

    #[test]
    fn windows_paths_resolve_like_upstream() {
        let p = JcodePaths::resolve_with_env(&standard_env()).unwrap();
        assert_eq!(p.user_home, r"C:\Users\Amina\.jcode");
        assert_eq!(p.install_root, r"C:\Users\Amina\AppData\Local\jcode");
        assert_eq!(p.bin_dir, r"C:\Users\Amina\AppData\Local\jcode\bin");
        assert_eq!(
            p.pinned_version_dir,
            r"C:\Users\Amina\AppData\Local\jcode\builds\versions\0.81.7"
        );
        assert_eq!(p.runtime_dir, r"C:\Users\Amina\AppData\Local\Temp\jcode-Amina");
        assert_eq!(p.api_socket, r"C:\Users\Amina\AppData\Local\Temp\jcode-Amina\jcode-api.sock");
        assert_eq!(p.legacy_socket, r"C:\Users\Amina\AppData\Local\Temp\jcode-Amina\jcode.sock");
    }

    #[test]
    fn overrides_win_and_validate() {
        let mut env = standard_env().0;
        env.insert("JCODE_HOME", r"D:\homes\jcode".to_string());
        env.insert("JCODE_RUNTIME_DIR", r"D:\rt".to_string());
        env.insert("JCODE_API_SOCKET", r"D:\rt\custom.sock".to_string());
        let p = JcodePaths::resolve_with_env(&FakeEnv(env)).unwrap();
        assert_eq!(p.user_home, r"D:\homes\jcode");
        assert_eq!(p.runtime_dir, r"D:\rt");
        assert_eq!(p.api_socket, r"D:\rt\custom.sock");
        // legacy socket still derives from the runtime dir
        assert_eq!(p.legacy_socket, r"D:\rt\jcode.sock");
    }

    #[test]
    fn traversal_and_relative_paths_fail_closed() {
        for (key, value) in [
            ("USERPROFILE", r"C:\Users\..\evil"),
            ("USERPROFILE", r".\relative"),
            ("USERPROFILE", ""),
            ("LOCALAPPDATA", r"C:\Users\..\.."),
            ("TEMP", "temp"),
        ] {
            let mut env = standard_env().0;
            env.insert(key, value.to_string());
            assert!(
                JcodePaths::resolve_with_env(&FakeEnv(env)).is_err(),
                "{key}={value:?} must be rejected"
            );
        }
    }

    #[test]
    fn username_is_sanitized_like_upstream() {
        assert_eq!(sanitize_user("../root; rm"), "rootrm");
        assert_eq!(sanitize_user("!!!"), "user");
        assert_eq!(sanitize_user(&"a".repeat(100)), "a".repeat(64));
    }

    #[test]
    fn pipe_name_matches_upstream_algorithm_shape() {
        // Reference vector computed with the upstream algorithm
        // (stem sanitized, sha256 of normalized path, first 16 hex chars).
        let p = windows_pipe_name(r"C:\Users\Amina\AppData\Local\Temp\jcode-Amina\jcode-api.sock");
        assert!(p.starts_with(r"\\.\pipe\jcode-api-"), "got {p}");
        let tail = p.trim_start_matches(r"\\.\pipe\jcode-api-");
        assert_eq!(tail.len(), 16);
        assert!(tail.bytes().all(|b| b.is_ascii_hexdigit()));
        // Deterministic and case-insensitive on the path text:
        assert_eq!(p, windows_pipe_name(r"c:\users\amina\appdata\local\temp\jcode-amina\jcode-api.sock"));
        // Same-directory sibling sockets share nothing but the scheme:
        let legacy = windows_pipe_name(r"C:\Users\Amina\AppData\Local\Temp\jcode-Amina\jcode.sock");
        assert_ne!(p, legacy);
        assert!(legacy.starts_with(r"\\.\pipe\jcode-"));
        // Degenerate path falls back to the `jcode` stem.
        let degenerate = windows_pipe_name("");
        assert!(degenerate.starts_with(r"\\.\pipe\jcode-"));
    }
}
