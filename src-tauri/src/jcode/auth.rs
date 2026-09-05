//! Authentication handoff and the redaction boundary.
//!
//! Coding Studio never stores provider credentials. Authentication belongs to
//! Jcode itself (`jcode login`, owner-only credential store managed by the
//! daemon); this module models that handoff as data, tracks only the
//! *configured/not-configured* bit arriving on `credential_updated` events,
//! and owns the secret redactor that every display/log path must pass
//! through.

use std::fmt;

/// How provider authentication reaches Jcode. There is deliberately no
/// variant that stores a credential inside Coding Studio.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuthHandoff {
    /// User runs `jcode login` themselves (OAuth browser flow, API-key paste,
    /// device code — all inside Jcode's own UI/CLI).
    JcodeInteractiveLogin,
    /// The harness API can persist an API key in Jcode's owner-only store
    /// (`set_api_key`, capability `api_key_provisioning`). OAuth tokens are
    /// excluded upstream. Coding Studio does not call this in Milestone One;
    /// whether it is ever wired is a Milestone Five decision.
    JcodeManagedApiKeyStore,
    /// Credentials may pre-exist in Jcode's home from the user's own CLI use;
    /// Coding Studio only observes the configured bit.
    PreExistingJcodeHome,
}

impl AuthHandoff {
    /// Handoff modes Coding Studio will rely on when a runtime is wired
    /// (Milestones 3+). Ordered by preference.
    pub fn plan() -> &'static [AuthHandoff] {
        &[
            AuthHandoff::PreExistingJcodeHome,
            AuthHandoff::JcodeInteractiveLogin,
        ]
    }
}

/// What Coding Studio is allowed to know about auth state: a boolean and a
/// provider label, never a credential.
#[derive(Clone, PartialEq, Eq)]
pub enum AuthState {
    Unknown,
    NotConfigured { provider: String },
    Configured { provider: String },
}

impl AuthState {
    /// Fold a `credential_updated { provider, configured }` event.
    pub fn from_credential_updated(provider: &str, configured: bool) -> Self {
        if configured {
            Self::Configured {
                provider: provider.to_string(),
            }
        } else {
            Self::NotConfigured {
                provider: provider.to_string(),
            }
        }
    }

    /// True when a provider credential exists. No secret material involved.
    pub fn is_configured(&self) -> bool {
        matches!(self, Self::Configured { .. })
    }
}

impl fmt::Debug for AuthState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        fmt::Display::fmt(self, f)
    }
}

impl fmt::Display for AuthState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Unknown => write!(f, "unknown"),
            Self::NotConfigured { provider } => {
                write!(f, "not-configured({})", bounded(&redact(provider), 32))
            }
            Self::Configured { provider } => {
                write!(f, "configured({})", bounded(&redact(provider), 32))
            }
        }
    }
}

/// Marker appended when content is length-capped.
pub const TRUNCATED: &str = "[truncated]";
/// Marker substituted for anything resembling a secret.
pub const REDACTED: &str = "[REDACTED]";

/// Length-cap a string for display/log output without splitting a UTF-8
/// sequence. Returns the string unchanged when it already fits.
pub fn bounded(input: &str, max: usize) -> String {
    if input.len() <= max {
        return input.to_string();
    }
    let mut end = max.min(input.len());
    while end > 0 && !input.is_char_boundary(end) {
        end -= 1;
    }
    let mut out = String::with_capacity(end + TRUNCATED.len());
    out.push_str(&input[..end]);
    out.push_str(TRUNCATED);
    out
}

/// Secret-shape markers. Matching is case-sensitive by design where upstream
/// providers are (token prefixes are case-significant); key=value matching is
/// case-insensitive on the key.
const TOKEN_MARKERS: &[&str] = &[
    "sk-", "ghp_", "gho_", "ghu_", "ghs_", "ghr_", "xoxb-", "xoxp-", "xoxa-", "AIza", "AKIA",
    "Bearer ", "eyJ", "-----BEGIN",
];

const SECRET_KEYS: &[&str] = &[
    "password",
    "passwd",
    "token",
    "secret",
    "api_key",
    "apikey",
    "api-key",
    "authorization",
    "cookie",
    "private_key",
    "client_secret",
];

fn is_token_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '/' | '+' | '=' | ':' | '~')
}

/// Mask one marker occurrence starting at `start`; returns bytes consumed
/// from `input` covering the marker and the token body (bounded).
fn consume_token(input: &str, start: usize, marker: &str) -> usize {
    let body_start = start + marker.len();
    let mut end = body_start;
    for (i, c) in input[body_start..].char_indices() {
        if !is_token_char(c) || i >= 96 {
            break;
        }
        end = body_start + i + c.len_utf8();
    }
    // Always cover at least the marker itself.
    end.max(body_start) - start
}

/// Redact anything that looks like a credential from display-bound text.
///
/// Defense in depth (see ADR-0008): shape matching, not a guarantee. Coding
/// Studio additionally never logs complete payloads.
pub fn redact(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut i = 0;
    while i < input.len() {
        let rest = &input[i..];
        // key=value / "key": "value" forms first (JSON-ish and shell-ish).
        if let Some((consumed, _)) = match_secret_kv(rest) {
            out.push_str(REDACTED);
            i += consumed;
            continue;
        }
        if let Some(marker) = TOKEN_MARKERS.iter().find(|m| rest.starts_with(**m)) {
            let span = consume_token(input, i, marker);
            out.push_str(REDACTED);
            i += span;
            continue;
        }
        let c = rest.chars().next().expect("loop guard ensures a char");
        out.push(c);
        i += c.len_utf8();
    }
    out
}

/// If `rest` begins with `secretish_key <sep> value` (optionally with a
/// leading `"` for JSON-ish text) return the consumed length. Separators:
/// `=`, `:`, possibly followed by whitespace and an opening quote.
fn match_secret_kv(rest: &str) -> Option<(usize, ())> {
    let unquoted = rest.strip_prefix('"').unwrap_or(rest);
    let skipped = rest.len() - unquoted.len();
    let lower = unquoted.to_ascii_lowercase();
    for key in SECRET_KEYS {
        if !lower.starts_with(key) {
            continue;
        }
        let after = &unquoted[key.len()..];
        let mut idx = 0;
        let bytes = after.as_bytes();
        // optional closing quote of a JSON-ish key (`"token": "…"`)
        if bytes.first() == Some(&b'"') {
            idx += 1;
        }
        // separator
        if bytes.get(idx) == Some(&b'=') || bytes.get(idx) == Some(&b':') {
            idx += 1;
        } else {
            continue;
        }
        // whitespace
        while bytes.get(idx).is_some_and(|b| b.is_ascii_whitespace()) {
            idx += 1;
        }
        // optional opening quote
        let opening_quote = match bytes.get(idx) {
            Some(&b'"') => Some(b'"'),
            Some(&b'\'') => Some(b'\''),
            _ => None,
        };
        if opening_quote.is_some() {
            idx += 1;
        }
        let value_start = key.len() + idx;
        let mut end = value_start;
        if let Some(q) = opening_quote {
            // Quoted value: consume through the closing quote.
            for (i, c) in unquoted[value_start..].char_indices() {
                end = value_start + i + c.len_utf8();
                if c == q as char || i >= 160 {
                    break;
                }
            }
        } else {
            // Unquoted value: consume the rest of the field (to end of line),
            // so compound secrets like `Authorization: Bearer aaa.bbb.ccc`
            // cannot leak their second half.
            for (i, c) in unquoted[value_start..].char_indices() {
                if c == '\n' || i >= 160 {
                    break;
                }
                end = value_start + i + c.len_utf8();
            }
        }
        if end == value_start {
            continue; // `token` with no value is not a secret
        }
        return Some((end + skipped, ()));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bounded_caps_without_splitting_utf8() {
        let s = "é".repeat(10); // 20 bytes
        let b = bounded(&s, 5);
        assert!(b.ends_with(TRUNCATED));
        assert!(b.starts_with("é"));
        assert_eq!(bounded("abc", 10), "abc");
    }

    #[test]
    fn redacts_token_prefixes() {
        for sample in [
            "key sk-proj-abcdef123456 ok",
            "x ghp_0123456789abcdef y",
            "x gho_abcdef y",
            "token xoxb-123-456",
            "g AIzaSyD4iE2xVSpk e",
            "aws AKIAIOSFODNN7EXAMPLE end",
            "h Bearer abc.def.ghi",
            "jwt eyJhbGciOiJIUzI1NiJ9.eyJj.123",
            "pem -----BEGIN PRIVATE KEY----- tail",
        ] {
            let r = redact(sample);
            assert!(r.contains(REDACTED), "not redacted: {sample} -> {r}");
        }
        assert_eq!(redact("sk-abc123"), REDACTED);
    }

    #[test]
    fn redacts_secret_key_value_forms() {
        for sample in [
            "token=abc123",
            "api_key: somevalue123",
            "\"authorization\": \"bearerstuff\"",
            "PASSWORD=hunter2",
            "client_secret = \'zz\'",
        ] {
            let r = redact(sample);
            assert!(r.contains(REDACTED), "not redacted: {sample} -> {r}");
            assert!(!r.contains("hunter2"));
        }
        // Non-secret words containing keys must survive.
        assert_eq!(redact("tokenizer is a word"), "tokenizer is a word");
    }

    #[test]
    fn leaves_normal_text_alone() {
        assert_eq!(redact("hello world"), "hello world");
        assert_eq!(redact("claude-sonnet-4"), "claude-sonnet-4");
    }

    #[test]
    fn auth_state_carries_no_secret() {
        let s = AuthState::from_credential_updated("anthropic", true);
        assert!(s.is_configured());
        assert_eq!(format!("{s}"), "configured(anthropic)");
        let dbg = format!("{s:?}");
        assert!(!dbg.contains("key"));
    }

    #[test]
    fn handoff_plan_never_includes_credential_storage() {
        for mode in AuthHandoff::plan() {
            assert_ne!(
                *mode,
                AuthHandoff::JcodeManagedApiKeyStore,
                "M1 must not depend on API provisioning; interactive/pre-existing only"
            );
        }
        assert!(!AuthHandoff::plan().is_empty());
    }
}
