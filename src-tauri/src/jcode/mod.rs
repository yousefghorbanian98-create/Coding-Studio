//! Jcode compatibility boundary for Coding Studio (Backend Milestone One).
//!
//! This module is a **contract and compatibility layer**, deliberately not a
//! process supervisor (Milestone Two) and not wired to Tauri IPC yet
//! (Milestone Three). It pins and verifies the official Jcode release, speaks
//! the official harness API wire contract (NDJSON, protocol major 1), and
//! normalizes events into Coding Studio-owned types with redaction-safe
//! debugging, bounded sizes, and deny-by-default capabilities.
//!
//! Hard invariants (test-locked):
//!
//! - Jcode is the only primary coding runtime; no provider SDKs, no Ollama or
//!   other local model runtime, no TUI scraping (ADRs 0001–0008).
//! - Upstream internal structs never cross this boundary; everything here is
//!   owned by Coding Studio.
//! - Unknown protocol traffic degrades to bounded, redacted diagnostics —
//!   never silently trusted.
//!
//! Upstream reference: `1jehuang/jcode` tag `v0.81.7`, commit
//! `358226c2a35b8b50d4d520b3363b0dc60c000fdb`.

/// Implements `fmt::Debug` by forwarding to `Display`, for boundary types
/// whose `Display` is already redaction-safe.
macro_rules! impl_debug_via_display {
    () => {
        fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
            fmt::Display::fmt(self, f)
        }
    };
}

pub(crate) use impl_debug_via_display;

pub mod auth;
pub mod config;
pub mod error;
pub mod lifecycle;
pub mod protocol;
pub mod verification;
pub mod version;

pub use error::{ErrorCode, JcodeError};
pub use lifecycle::{capability, product_facing, require, ProviderClass, Support};
pub use version::{
    PINNED_JCODE_COMMIT, PINNED_JCODE_TAG, PINNED_JCODE_REPO, PINNED_JCODE_VERSION,
    VersionCompatibility, VersionReport,
};
