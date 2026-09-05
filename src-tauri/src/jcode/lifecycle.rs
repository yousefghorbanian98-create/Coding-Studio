//! Lifecycle capability representation and the launch policy.
//!
//! The `CAPABILITIES` table is the machine-readable form of
//! `docs/backend-factory/evidence/milestone-one/capability-matrix.md`.
//! Negotiation is deny-by-default: only `Supported` may be used; `Unknown`
//! stays unknown and is never promoted.

use crate::jcode::error::{ErrorCode, JcodeError};
use std::fmt;

/// Capability support state. `Unknown` is evidence of absence of evidence —
/// it behaves exactly like `Unsupported` for gating.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Support {
    Supported,
    Unsupported,
    Unknown,
}

impl Support {
    pub fn is_supported(self) -> bool {
        matches!(self, Self::Supported)
    }
}

impl fmt::Display for Support {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Supported => write!(f, "supported"),
            Self::Unsupported => write!(f, "unsupported"),
            Self::Unknown => write!(f, "unknown"),
        }
    }
}

/// One capability row. `evidence` is always an exact upstream file/command at
/// the pinned tag (or an explicit admission of absence).
#[derive(Debug, Clone, Copy)]
pub struct CapabilityRow {
    pub id: &'static str,
    pub support: Support,
    /// Exact upstream file/command evidence, or "none found" for unknown.
    pub evidence: &'static str,
    /// Whether Coding Studio exposes this across the (future) product IPC.
    pub product_facing: bool,
}

/// Capability inventory for the pinned release (`v0.81.7`, harness API v1).
/// Row-by-row prose mapping lives in the capability-matrix evidence doc.
pub const CAPABILITIES: &[CapabilityRow] = &[
    CapabilityRow { id: "version-output", support: Support::Supported, evidence: "src/cli/commands/report_info.rs:415 `jcode version --json`", product_facing: true },
    CapabilityRow { id: "health-doctor", support: Support::Supported, evidence: "src/cli/args.rs AuthCommand::Doctor/Status; docs/PROVIDER_DOCTOR.md (`--tier offline` keyless)", product_facing: true },
    CapabilityRow { id: "headless-run", support: Support::Supported, evidence: "src/cli/args.rs Command::Run (--json/--ndjson)", product_facing: false },
    CapabilityRow { id: "structured-events", support: Support::Supported, evidence: "crates/jcode-harness-api/src/events.rs ApiEvent (ev-tagged, v1)", product_facing: true },
    CapabilityRow { id: "server-client-mode", support: Support::Supported, evidence: "src/cli/args.rs:557 `api-bridge`; crates/jcode-sdk/src/launch.rs:505 ensure_runtime", product_facing: false },
    CapabilityRow { id: "rust-sdk-inrepo", support: Support::Supported, evidence: "crates/jcode-sdk (publish=false, not on crates.io)", product_facing: false },
    CapabilityRow { id: "typescript-sdk", support: Support::Supported, evidence: "sdk/typescript @1jehuang/jcode-sdk (npm 1.1.0, repo 1.2.0, MIT)", product_facing: false },
    CapabilityRow { id: "session-create", support: Support::Supported, evidence: "harness-api requests.rs CreateSession -> events.rs Attached", product_facing: true },
    CapabilityRow { id: "session-resume", support: Support::Supported, evidence: "AttachSession+ListSessions (persisted); docs/RESUME_BEHAVIOR.md", product_facing: true },
    CapabilityRow { id: "streaming-response", support: Support::Supported, evidence: "events.rs TextDelta/ReasoningDelta", product_facing: true },
    CapabilityRow { id: "tool-call-events", support: Support::Supported, evidence: "events.rs ToolStart/ToolInputDelta/ToolExec/ToolDone", product_facing: true },
    CapabilityRow { id: "approval-request-events", support: Support::Supported, evidence: "events.rs PermissionRequest{request_id}", product_facing: true },
    CapabilityRow { id: "approval-response-input", support: Support::Supported, evidence: "requests.rs PermissionResponse{decision: allow|allow_always|deny}", product_facing: true },
    CapabilityRow { id: "cancellation-request", support: Support::Supported, evidence: "requests.rs Cancel{session_id}", product_facing: true },
    CapabilityRow { id: "cancellation-completion-event", support: Support::Unknown, evidence: "no dedicated cancelled/interrupted event in harness v1; `run --ndjson` emits {\"type\":\"interrupted\"} (commands.rs:3133)", product_facing: false },
    CapabilityRow { id: "graceful-shutdown-cli", support: Support::Supported, evidence: "src/cli/args.rs `jcode server stop`", product_facing: false },
    CapabilityRow { id: "graceful-shutdown-protocol", support: Support::Unknown, evidence: "no shutdown frame in harness v1 (events.rs)", product_facing: false },
    CapabilityRow { id: "forced-termination", support: Support::Unknown, evidence: "no protocol concept; upstream issue #1081 (Windows descendants can survive)", product_facing: false },
    CapabilityRow { id: "exit-codes", support: Support::Unknown, evidence: "no documented table; nonzero on error paths (e.g. commands.rs:1992)", product_facing: false },
    CapabilityRow { id: "stdout-contract", support: Support::Supported, evidence: "NDJSON/JSON only on stdout (commands.rs write_json_line)", product_facing: false },
    CapabilityRow { id: "stderr-contract", support: Support::Supported, evidence: "bridge operator notices via eprintln (harness-api-server)", product_facing: false },
    CapabilityRow { id: "configuration-discovery", support: Support::Supported, evidence: "sockets.rs runtime_dir(); sdk launch.rs user_jcode_home (JCODE_HOME); docs/WINDOWS.md install paths", product_facing: false },
    CapabilityRow { id: "provider-discovery", support: Support::Supported, evidence: "events.rs RuntimeInfo/ModelInfo/Models; `jcode provider` family", product_facing: true },
    CapabilityRow { id: "authentication-handoff", support: Support::Supported, evidence: "`jcode login`; set_api_key (owner-only store; OAuth excluded); jcode auth status/doctor", product_facing: true },
    CapabilityRow { id: "error-events", support: Support::Supported, evidence: "events.rs Error{code:5 variants,message}", product_facing: true },
    CapabilityRow { id: "protocol-version-negotiation", support: Support::Supported, evidence: "harness-api lib.rs API_VERSION_MAJOR=1/MINOR=0; api-server lib.rs hello range check", product_facing: true },
    CapabilityRow { id: "event-sequence-ids", support: Support::Unsupported, evidence: "ServerFrame{v,reply_to,event} carries no global sequence (lib.rs)", product_facing: false },
    CapabilityRow { id: "correlation-ids", support: Support::Supported, evidence: "id/reply_to + session_id + call_id + permission request_id", product_facing: true },
    CapabilityRow { id: "duplicate-event-behavior", support: Support::Unknown, evidence: "no dedup ids in protocol v1", product_facing: false },
    CapabilityRow { id: "malformed-frame-behavior", support: Support::Supported, evidence: "api-server lib.rs: invalid_request error + close; oversized frame closes stream", product_facing: false },
    CapabilityRow { id: "max-frame-limits", support: Support::Supported, evidence: "api-server lib.rs:42 MAX_FRAME_BYTES=16 MiB; CS bound 4 MiB", product_facing: false },
    CapabilityRow { id: "windows-x86-64", support: Support::Supported, evidence: "release.yml build-windows x86_64-pc-windows-msvc on windows-latest; docs/WINDOWS.md manually verified", product_facing: true },
    CapabilityRow { id: "windows-aarch64", support: Support::Supported, evidence: "release.yml aarch64-pc-windows-msvc on windows-11-arm + verify_windows_install.ps1", product_facing: true },
    CapabilityRow { id: "local-embeddings-disabled-policy", support: Support::Supported, evidence: "config-types FeatureConfig.memory (default true) -> CS overrides false; jcode-embedding is in-process ONNX (no network)", product_facing: false },
    // Permanently denied surfaces (ADR-005/ADR-007):
    CapabilityRow { id: "local-model-runtime", support: Support::Unsupported, evidence: "none applicable — excluded by Coding Studio contract", product_facing: false },
    CapabilityRow { id: "ollama", support: Support::Unsupported, evidence: "upstream mentions confined to jcode-provider-openrouter-runtime/ollama_context.rs; CS never restores/exposes/configures it", product_facing: false },
    CapabilityRow { id: "tui-scraping", support: Support::Unsupported, evidence: "prohibited by mission; structurally impossible through FrameDecoder", product_facing: false },
];

/// Permanently denied capability ids (ADR-005, ADR-007).
pub const PERMANENTLY_DENIED: &[&str] = &["local-model-runtime", "ollama", "tui-scraping"];

/// Capability state lookup. Absent id = unknown (deny-by-default).
pub fn capability(id: &str) -> Support {
    CAPABILITIES
        .iter()
        .find(|r| r.id == id)
        .map(|r| r.support)
        .unwrap_or(Support::Unknown)
}

/// Gate a capability use: only `Supported` passes. Unknown and unsupported
/// both fail closed with an actionable error.
pub fn require(id: &str) -> Result<(), JcodeError> {
    match capability(id) {
        Support::Supported => Ok(()),
        Support::Unsupported => Err(JcodeError::new(
            if PERMANENTLY_DENIED.contains(&id) { ErrorCode::LocalRuntimeDenied } else { ErrorCode::CapabilityDenied },
            format!("capability `{id}` is permanently denied or unsupported on the pinned release"),
        )),
        Support::Unknown => Err(JcodeError::new(
            ErrorCode::CapabilityDenied,
            format!("capability `{id}` has no verified evidence on the pinned release; unknown stays unknown"),
        )),
    }
}

/// Ids of capabilities the product may surface (future Milestone Three IPC).
/// Structurally excludes every permanently denied row — no local model or
/// Ollama entry can appear here.
pub fn product_facing() -> Vec<&'static str> {
    CAPABILITIES
        .iter()
        .filter(|r| r.product_facing && r.support.is_supported() && !PERMANENTLY_DENIED.contains(&r.id))
        .map(|r| r.id)
        .collect()
}

/// How Coding Studio treats a provider label observed in events.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderClass {
    /// Remote provider managed by Jcode (the only product-supported class).
    RemoteManaged,
    /// Local model runtime (ollama, llama.cpp, localai, lm-studio, ...):
    /// denied. Never a product capability (ADR-007).
    DeniedLocalRuntime,
    /// Label absent or unrecognized: treated as unknown, never trusted.
    Unknown,
}

/// Local-runtime fingerprints. Substring match on a lowercased label.
const LOCAL_RUNTIME_HINTS: &[&str] = &[
    "ollama",
    "11434", // Ollama's default port, e.g. localhost:11434 endpoint labels
    "llama.cpp",
    "llamacpp",
    "localai",
    "lm-studio",
    "lm studio",
    "lmstudio",
    "local-model",
    "on-device",
];

pub fn classify_provider_label(label: Option<&str>) -> ProviderClass {
    let Some(label) = label.map(str::trim) else {
        return ProviderClass::Unknown;
    };
    if label.is_empty() {
        return ProviderClass::Unknown;
    }
    let lower = label.to_ascii_lowercase();
    if LOCAL_RUNTIME_HINTS.iter().any(|h| lower.contains(h)) {
        return ProviderClass::DeniedLocalRuntime;
    }
    ProviderClass::RemoteManaged
}

/// Capabilities the pinned bridge advertises in `hello_ok` that Coding
/// Studio understands. Anything else in the advertisement is tolerated
/// (additive) but unused; anything missing here downgrades cleanly.
pub const EXPECTED_SERVER_CAPABILITIES: &[&str] = &[
    "sessions",
    "streaming",
    "persisted_session_discovery",
    "runtime_info",
    "api_key_provisioning",
    "session_archive",
    "session_retention",
    "session_files",
    "session_fork",
];

/// Result of comparing a live `hello_ok` capability list to expectations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerCapabilityCheck {
    /// Expected upstream strings that were absent (degraded, fails closed at
    /// the affected feature — e.g. missing `streaming` disables streaming).
    pub missing: Vec<String>,
    /// Advertised strings Coding Studio does not know (additive; ignored).
    pub unrecognized: Vec<String>,
}

pub fn check_server_capabilities(advertised: &[String]) -> ServerCapabilityCheck {
    let missing = EXPECTED_SERVER_CAPABILITIES
        .iter()
        .filter(|e| !advertised.iter().any(|a| a == **e))
        .map(|s| (*s).to_string())
        .collect();
    let unrecognized = advertised
        .iter()
        .filter(|a| !EXPECTED_SERVER_CAPABILITIES.contains(&a.as_str()))
        .cloned()
        .collect();
    ServerCapabilityCheck { missing, unrecognized }
}

/// How a child process ended and what Coding Studio concludes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExitDisposition {
    /// exit code 0
    Clean,
    /// nonzero exit code: failure; stderr may carry diagnostics.
    Failed(i32),
    /// terminated by signal/forced kill (no exit code).
    ForcedTermination,
}

pub fn classify_exit(code: Option<i32>) -> ExitDisposition {
    match code {
        Some(0) => ExitDisposition::Clean,
        Some(n) => ExitDisposition::Failed(n),
        None => ExitDisposition::ForcedTermination,
    }
}

/// Declarative launch policy for the future supervisor (Milestone Two).
/// Values are pinned by tests so a diff must consciously change them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LaunchPolicy {
    pub telemetry_off: bool,
    pub do_not_track: bool,
    pub memory_feature_enabled: bool,
    pub sets_embedding_backend_env: bool,
    pub uses_local_model_runtime: bool,
    pub injects_credentials: bool,
}

impl LaunchPolicy {
    pub fn coding_studio_default() -> Self {
        Self {
            telemetry_off: true,
            do_not_track: true,
            memory_feature_enabled: false,
            sets_embedding_backend_env: false,
            uses_local_model_runtime: false,
            injects_credentials: false,
        }
    }

    /// Environment overlay the supervisor will apply (M2 implements; M1 pins).
    /// Upstream honors both variables (`TELEMETRY.md`).
    pub fn env_overlay(&self) -> Vec<(&'static str, &'static str)> {
        let mut out = Vec::new();
        if self.telemetry_off {
            out.push(("JCODE_NO_TELEMETRY", "1"));
        }
        if self.do_not_track {
            out.push(("DO_NOT_TRACK", "1"));
        }
        out
    }

    /// Managed-config key/value pairs (upstream `config.toml` semantics).
    pub fn config_overrides(&self) -> Vec<(&'static str, &'static str)> {
        let mut out = Vec::new();
        if !self.memory_feature_enabled {
            // upstream: crates/jcode-config-types FeatureConfig.memory
            out.push(("features.memory", "false"));
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matrix_has_all_required_rows_with_evidence() {
        let required = [
            "version-output",
            "health-doctor",
            "headless-run",
            "structured-events",
            "server-client-mode",
            "rust-sdk-inrepo",
            "typescript-sdk",
            "session-create",
            "session-resume",
            "streaming-response",
            "tool-call-events",
            "approval-request-events",
            "approval-response-input",
            "cancellation-request",
            "cancellation-completion-event",
            "graceful-shutdown-cli",
            "graceful-shutdown-protocol",
            "forced-termination",
            "exit-codes",
            "stdout-contract",
            "stderr-contract",
            "configuration-discovery",
            "provider-discovery",
            "authentication-handoff",
            "error-events",
            "protocol-version-negotiation",
            "event-sequence-ids",
            "correlation-ids",
            "duplicate-event-behavior",
            "malformed-frame-behavior",
            "max-frame-limits",
            "windows-x86-64",
            "windows-aarch64",
            "local-embeddings-disabled-policy",
        ];
        assert_eq!(CAPABILITIES.len(), required.len() + PERMANENTLY_DENIED.len());
        for id in required {
            let row = CAPABILITIES.iter().find(|r| r.id == id).unwrap_or_else(|| panic!("missing row {id}"));
            assert!(!row.evidence.is_empty(), "row {id} must carry evidence");
        }
    }

    #[test]
    fn negotiation_is_deny_by_default() {
        assert!(require("version-output").is_ok());
        for denied in ["event-sequence-ids", "duplicate-event-behavior", "ollama", "local-model-runtime", "tui-scraping", "never-heard-of-this"] {
            assert!(require(denied).is_err(), "{denied} must fail closed");
        }
        assert_eq!(require("ollama").unwrap_err().code(), ErrorCode::LocalRuntimeDenied);
        assert_eq!(require("never-heard-of-this").unwrap_err().code(), ErrorCode::CapabilityDenied);
        assert_eq!(capability("nope"), Support::Unknown);
    }

    #[test]
    fn product_facing_set_excludes_all_denied_and_local() {
        let pf = product_facing();
        assert!(pf.contains(&"streaming-response"));
        for id in &pf {
            assert!(!PERMANENTLY_DENIED.contains(id), "{id} leaked into product set");
            assert!(!id.contains("ollama"));
            assert!(!id.contains("local"));
        }
        assert!(!pf.contains(&"ollama"));
        assert!(!pf.contains(&"local-model-runtime"));
    }

    #[test]
    fn local_runtime_labels_are_denied() {
        for label in ["ollama", "Ollama", "local-ollama", "http://localhost:11434", "llama.cpp-7b", "LM Studio", "localai"] {
            assert_eq!(
                classify_provider_label(Some(label)),
                ProviderClass::DeniedLocalRuntime,
                "{label} must classify denied"
            );
        }
        assert_eq!(classify_provider_label(Some("anthropic")), ProviderClass::RemoteManaged);
        assert_eq!(classify_provider_label(Some("openai")), ProviderClass::RemoteManaged);
        assert_eq!(classify_provider_label(Some("zzz-unknown")), ProviderClass::RemoteManaged);
        assert_eq!(classify_provider_label(Some("")), ProviderClass::Unknown);
        assert_eq!(classify_provider_label(None), ProviderClass::Unknown);
    }

    #[test]
    fn server_capability_check_degrades_cleanly() {
        let full: Vec<String> = EXPECTED_SERVER_CAPABILITIES.iter().map(|s| s.to_string()).collect();
        let check = check_server_capabilities(&full);
        assert!(check.missing.is_empty());
        assert!(check.unrecognized.is_empty());

        let partial = vec!["sessions".to_string(), "future_additive".to_string()];
        let check = check_server_capabilities(&partial);
        assert!(check.missing.contains(&"streaming".to_string()));
        assert_eq!(check.unrecognized, vec!["future_additive".to_string()]);
        assert!(!check_server_capabilities(&partial).unrecognized.contains(&"sessions".to_string()));
    }

    #[test]
    fn exit_classification() {
        assert_eq!(classify_exit(Some(0)), ExitDisposition::Clean);
        assert_eq!(classify_exit(Some(2)), ExitDisposition::Failed(2));
        assert_eq!(classify_exit(None), ExitDisposition::ForcedTermination);
    }

    #[test]
    fn launch_policy_disables_telemetry_memory_and_local_runtimes() {
        let p = LaunchPolicy::coding_studio_default();
        assert!(p.telemetry_off && p.do_not_track);
        assert!(!p.memory_feature_enabled);
        assert!(!p.sets_embedding_backend_env);
        assert!(!p.uses_local_model_runtime);
        assert!(!p.injects_credentials);
        assert_eq!(p.env_overlay(), vec![("JCODE_NO_TELEMETRY", "1"), ("DO_NOT_TRACK", "1")]);
        assert_eq!(p.config_overrides(), vec![("features.memory", "false")]);
        for (key, _) in p.env_overlay() {
            assert!(!key.to_ascii_lowercase().contains("key"), "env overlay never carries credential keys");
        }
    }
}
