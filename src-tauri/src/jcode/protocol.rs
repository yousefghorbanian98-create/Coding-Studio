//! Coding Studio-owned client for the jcode **harness API** wire contract.
//!
//! Selected surface (ADR-0003): NDJSON over the platform-local transport,
//! envelope `{v, id, req…}` / `{v, reply_to?, ev…}`, protocol major 1.
//! Upstream reference (not linked, not vendored):
//! `crates/jcode-harness-api` at `1jehuang/jcode` tag `v0.81.7`
//! (commit `358226c2a35b8b50d4d520b3363b0dc60c000fdb`).
//!
//! Contract rules implemented here:
//!
//! - frames are single-line JSON objects; control bytes (incl. ANSI `ESC`)
//!   never parse — terminal scraping is structurally impossible (ADR-0005);
//! - protocol major is deny-by-default: only `v == 1` is accepted;
//! - unknown event kinds are preserved only as a bounded kind string
//!   (`EventKind::Unknown`), raw payloads are dropped;
//! - dynamic text travels inside [`Content`], whose `Debug`/`Display` redact
//!   and length-cap;
//! - identifiers are validated newtypes with a restricted charset;
//! - no global sequence exists upstream, so [`EventSequencer`] assigns a
//!   monotonic `seq` at ingest and detects exact-duplicate adjacent frames;
//! - approvals resolve only against outstanding `request_id`s.

use crate::jcode::auth::{bounded, redact};
use crate::jcode::error::{ErrorCode, JcodeError};
use crate::jcode::impl_debug_via_display;
use serde::Deserialize;
use std::collections::{HashSet, VecDeque};
use std::fmt;
use std::io::BufRead;

/// Only protocol major Coding Studio speaks.
pub const PROTOCOL_MAJOR: u32 = 1;
/// Additive minor we were verified against (informational).
pub const PROTOCOL_MINOR_VERIFIED: u32 = 0;
/// Product-side frame bound. Upstream's bridge accepts 16 MiB; Coding Studio
/// deliberately bounds tighter. Anything larger is an actionable error, never
/// a silent allocation.
pub const MAX_FRAME_BYTES: usize = 4 * 1024 * 1024;
/// Cap on the event-kind tag we bother remembering for diagnostics.
pub const MAX_KIND_LEN: usize = 64;
/// Identifier length bound.
pub const MAX_ID_LEN: usize = 128;
/// Display length for any single dynamic string.
pub const MAX_CONTENT_DISPLAY: usize = 160;
/// Adjacent-window exact-duplicate detection size.
pub const DEDUP_WINDOW: usize = 8;
/// Cap on concurrently outstanding approvals/requests (memory bound).
pub const MAX_OUTSTANDING: usize = 1024;
/// Outbound user-message cap (256 KiB of text).
pub const MAX_OUTBOUND_MESSAGE: usize = 256 * 1024;
/// Cap on sessions/model/route lists carried across the boundary.
pub const MAX_LIST_ITEMS: usize = 512;

// ---------------------------------------------------------------------------
// Content: dynamic text that is redacted on every display path.
// ---------------------------------------------------------------------------

/// A string received from the runtime. Equality/reads are exact; printing is
/// always redacted and length-capped.
#[derive(Clone, PartialEq, Eq, Default)]
pub struct Content(String);

impl Content {
    pub fn new(raw: impl Into<String>) -> Self {
        Self(raw.into())
    }
    /// Raw content for in-process transcript assembly (not for logs).
    pub fn as_str(&self) -> &str {
        &self.0
    }
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl fmt::Display for Content {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", bounded(&redact(&self.0), MAX_CONTENT_DISPLAY))
    }
}

impl fmt::Debug for Content {
    impl_debug_via_display!();
}

// ---------------------------------------------------------------------------
// Identifier newtypes
// ---------------------------------------------------------------------------

macro_rules! id_newtype {
    ($name:ident, $doc:literal) => {
        #[doc = $doc]
        #[derive(Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
        pub struct $name(String);

        impl $name {
            pub fn new(raw: impl Into<String>) -> Result<Self, JcodeError> {
                let raw = raw.into();
                if raw.is_empty() || raw.len() > MAX_ID_LEN {
                    return Err(JcodeError::new(
                        ErrorCode::InvalidIdentifier,
                        format!(concat!(stringify!($name), " length outside 1..={}"), MAX_ID_LEN),
                    ));
                }
                if !raw
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b':' | b'@'))
                {
                    return Err(JcodeError::new(
                        ErrorCode::InvalidIdentifier,
                        concat!(stringify!($name), " contains characters outside [A-Za-z0-9._:@-]"),
                    ));
                }
                Ok(Self(raw))
            }
            pub fn as_str(&self) -> &str {
                &self.0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                // Identifiers are validated and bounded, but still pass the
                // redactor: cheap, and harmless for legal values.
                write!(f, "{}", bounded(&redact(&self.0), 48))
            }
        }

        impl fmt::Debug for $name {
            impl_debug_via_display!();
        }
    };
}

id_newtype!(SessionId, "Validated jcode session identifier.");
id_newtype!(ToolCallId, "Validated tool-call correlation identifier.");
id_newtype!(PermissionRequestId, "Validated approval-request identifier.");
id_newtype!(TaskId, "Validated background-task identifier.");

// ---------------------------------------------------------------------------
// Normalized inbound events (CS vocabulary; upstream names noted per arm)
// ---------------------------------------------------------------------------

/// Brief session record crossing the boundary.
#[derive(Clone, PartialEq, Eq)]
pub struct SessionBrief {
    pub session_id: SessionId,
    pub status: Option<Content>,
    pub title: Option<Content>,
}

impl fmt::Debug for SessionBrief {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("SessionBrief")
            .field("session_id", &self.session_id)
            .field("status", &self.status)
            .field("title", &self.title)
            .finish()
    }
}

/// One provider route offered by the daemon's runtime info.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RouteInfo {
    pub model: Content,
    pub provider: Content,
    pub available: Option<bool>,
}

/// Remote error codes on the wire (`error { code: … }`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RemoteErrorCode {
    UnsupportedVersion,
    UnknownRequest,
    UnknownSession,
    InvalidRequest,
    Internal,
    /// A code added by a newer minor protocol we don't know yet.
    Unknown,
}

impl RemoteErrorCode {
    fn from_wire(code: &str) -> Self {
        match code {
            "unsupported_version" => Self::UnsupportedVersion,
            "unknown_request" => Self::UnknownRequest,
            "unknown_session" => Self::UnknownSession,
            "invalid_request" => Self::InvalidRequest,
            "internal" => Self::Internal,
            _ => Self::Unknown,
        }
    }
}

/// Normalized server-to-client event. Every variant name carries the upstream
/// `ev` tag in its doc comment.
#[derive(Clone, Debug, PartialEq)]
pub enum EventKind {
    /// `hello_ok` — handshake accepted; negotiated major + server identity.
    HelloOk {
        negotiated_major: u32,
        server: Content,
        capabilities: Vec<String>,
    },
    /// `ok` — generic acknowledgment.
    Ok,
    /// `error` — structured failure (message is untrusted text).
    RemoteError { code: RemoteErrorCode, message: Content },
    /// `sessions` — bounded list reply.
    Sessions { sessions: Vec<SessionBrief>, truncated: bool },
    /// `attached` / `session_forked` — session handle (re)issued.
    Attached { session: SessionBrief, forked: bool },
    /// `history` — transcript reply; only the count crosses the boundary.
    History { session_id: SessionId, message_count: u64 },
    /// `pong`.
    Pong,
    /// `text_delta` — assistant text stream.
    TextDelta { session_id: SessionId, text: Content },
    /// `reasoning_delta` — reasoning stream (display-dim; safe to ignore).
    ReasoningDelta { session_id: SessionId, text: Content },
    /// `reasoning_done`.
    ReasoningDone { session_id: SessionId },
    /// `tool_start` / `tool_exec`.
    ToolCallStart { session_id: SessionId, call_id: ToolCallId, name: Content, executing: bool },
    /// `tool_input_delta`.
    ToolCallInput { session_id: SessionId, call_id: ToolCallId, delta: Content },
    /// `tool_done`.
    ToolCallDone {
        session_id: SessionId,
        call_id: ToolCallId,
        name: Content,
        output: Content,
        error: Option<Content>,
    },
    /// `side_pane_images` — carried as a count; image bytes never enter the
    /// boundary (bounded memory policy).
    MediaAvailable { session_id: SessionId, count: u64 },
    /// `token_usage`.
    TokenUsage { session_id: SessionId, input: u64, output: u64, cache_read_input: Option<u64> },
    /// `turn_done` — the agent is idle (also how a completed `cancel` shows).
    TurnCompleted { session_id: SessionId },
    /// `message_accepted` — the agent queued our message.
    MessageAccepted { session_id: SessionId },
    /// `permission_request` — an approval decision is required.
    PermissionRequested {
        session_id: SessionId,
        request_id: PermissionRequestId,
        tool_name: Content,
        description: Option<Content>,
    },
    /// `session_status` / `connection_phase`.
    StatusChanged { session_id: SessionId, status: Content },
    /// `connection_phase`.
    ConnectionPhase { session_id: SessionId, phase: Content },
    /// `model_info` — provider route serving the session.
    ModelInfo {
        session_id: SessionId,
        provider: Option<Content>,
        model: Option<Content>,
        effort: Option<Content>,
    },
    /// `models` — bounded model list reply.
    ModelsListed { session_id: SessionId, models: Vec<String>, current: Option<String>, truncated: bool },
    /// `runtime_info` — provider identity + bounded route list.
    RuntimeInfo {
        session_id: SessionId,
        provider: Option<Content>,
        model: Option<Content>,
        routes: Vec<RouteInfo>,
        truncated: bool,
    },
    /// `credential_updated` — the only auth signal: a boolean flag.
    CredentialUpdated { provider: Content, configured: bool },
    /// `compacted`.
    Compacted { session_id: SessionId, message: Option<Content> },
    /// `session_renamed`.
    SessionRenamed { session_id: SessionId, display_title: Content },
    /// `wake_requested`.
    WakeRequested { session_id: SessionId, reason: Content },
    /// `background_progress`.
    BackgroundProgress {
        session_id: SessionId,
        task_id: TaskId,
        label: Option<Content>,
        percent: Option<f32>,
        done: bool,
    },
    /// A kind the pinned protocol does *recognize* but Milestone One does not
    /// carry (`file_content`, `files`, `text_matches`, `file_status`).
    UncarriedKnown { kind: String },
    /// A kind the pinned protocol does not know (additive minor traffic).
    /// Only the bounded kind string survives; the payload is dropped.
    Unknown { kind: String },
}

impl EventKind {
    /// Session this event belongs to, when it has one.
    pub fn session_id(&self) -> Option<&SessionId> {
        match self {
            EventKind::HelloOk { .. }
            | EventKind::Ok
            | EventKind::RemoteError { .. }
            | EventKind::Sessions { .. }
            | EventKind::Pong
            | EventKind::CredentialUpdated { .. }
            | EventKind::UncarriedKnown { .. }
            | EventKind::Unknown { .. } => None,
            EventKind::Attached { session, .. } => Some(&session.session_id),
            EventKind::History { session_id, .. }
            | EventKind::TextDelta { session_id, .. }
            | EventKind::ReasoningDelta { session_id, .. }
            | EventKind::ReasoningDone { session_id }
            | EventKind::ToolCallStart { session_id, .. }
            | EventKind::ToolCallInput { session_id, .. }
            | EventKind::ToolCallDone { session_id, .. }
            | EventKind::MediaAvailable { session_id, .. }
            | EventKind::TokenUsage { session_id, .. }
            | EventKind::TurnCompleted { session_id }
            | EventKind::MessageAccepted { session_id }
            | EventKind::PermissionRequested { session_id, .. }
            | EventKind::StatusChanged { session_id, .. }
            | EventKind::ConnectionPhase { session_id, .. }
            | EventKind::ModelInfo { session_id, .. }
            | EventKind::ModelsListed { session_id, .. }
            | EventKind::RuntimeInfo { session_id, .. }
            | EventKind::Compacted { session_id, .. }
            | EventKind::SessionRenamed { session_id, .. }
            | EventKind::WakeRequested { session_id, .. }
            | EventKind::BackgroundProgress { session_id, .. } => Some(session_id),
        }
    }

    /// Short stable kind name for metrics/logs (no payload).
    pub fn name(&self) -> &'static str {
        match self {
            EventKind::HelloOk { .. } => "hello_ok",
            EventKind::Ok => "ok",
            EventKind::RemoteError { .. } => "error",
            EventKind::Sessions { .. } => "sessions",
            EventKind::Attached { .. } => "attached",
            EventKind::History { .. } => "history",
            EventKind::Pong => "pong",
            EventKind::TextDelta { .. } => "text_delta",
            EventKind::ReasoningDelta { .. } => "reasoning_delta",
            EventKind::ReasoningDone { .. } => "reasoning_done",
            EventKind::ToolCallStart { .. } => "tool_call_start",
            EventKind::ToolCallInput { .. } => "tool_call_input",
            EventKind::ToolCallDone { .. } => "tool_call_done",
            EventKind::MediaAvailable { .. } => "media_available",
            EventKind::TokenUsage { .. } => "token_usage",
            EventKind::TurnCompleted { .. } => "turn_completed",
            EventKind::MessageAccepted { .. } => "message_accepted",
            EventKind::PermissionRequested { .. } => "permission_requested",
            EventKind::StatusChanged { .. } => "status_changed",
            EventKind::ConnectionPhase { .. } => "connection_phase",
            EventKind::ModelInfo { .. } => "model_info",
            EventKind::ModelsListed { .. } => "models_listed",
            EventKind::RuntimeInfo { .. } => "runtime_info",
            EventKind::CredentialUpdated { .. } => "credential_updated",
            EventKind::Compacted { .. } => "compacted",
            EventKind::SessionRenamed { .. } => "session_renamed",
            EventKind::WakeRequested { .. } => "wake_requested",
            EventKind::BackgroundProgress { .. } => "background_progress",
            EventKind::UncarriedKnown { .. } => "uncarried_known",
            EventKind::Unknown { .. } => "unknown",
        }
    }
}

/// One decoded server frame.
#[derive(Clone, Debug, PartialEq)]
pub struct ServerFrameView {
    pub major: u32,
    /// Request id this frame answers, when it is a direct reply.
    pub reply_to: Option<u64>,
    pub event: EventKind,
}

// ---------------------------------------------------------------------------
// Inbound decoding
// ---------------------------------------------------------------------------

fn json_value_to_event(value: serde_json::Value) -> Result<EventKind, JcodeError> {
    let kind_raw = value
        .get("ev")
        .and_then(|v| v.as_str())
        .ok_or_else(|| JcodeError::new(ErrorCode::MissingRequiredField, "event has no `ev` tag"))?;
    let kind_bounded = bounded(&redact(kind_raw), MAX_KIND_LEN);

    let parse = |value: &serde_json::Value, what: &'static str| -> serde_json::Value {
        // Strip envelope keys so payload structs never see them.
        let mut v = value.clone();
        if let Some(map) = v.as_object_mut() {
            map.remove("ev");
            map.remove("v");
            map.remove("reply_to");
        }
        let _ = what;
        v
    };

    macro_rules! payload {
        ($ty:ty, $value:expr, $what:literal) => {
            serde_json::from_value::<$ty>(parse($value, $what)).map_err(|e| {
                JcodeError::new(ErrorCode::MissingRequiredField, format!("{} payload: {e}", $what))
            })?
        };
    }

    #[derive(Deserialize)]
    struct SessionRef {
        session_id: String,
    }
    #[derive(Deserialize)]
    struct HelloOkWire {
        version: u32,
        server: String,
        #[serde(default)]
        capabilities: Vec<String>,
    }
    #[derive(Deserialize)]
    struct ErrorWire {
        code: String,
        message: String,
    }
    #[derive(Deserialize)]
    struct SessionsWire {
        sessions: Vec<SessionBriefWire>,
    }
    #[derive(Deserialize)]
    struct AttachedWire {
        session: SessionBriefWire,
    }
    #[derive(Deserialize)]
    struct SessionBriefWire {
        session_id: String,
        #[serde(default)]
        status: Option<String>,
        #[serde(default)]
        title: Option<String>,
    }
    #[derive(Deserialize)]
    struct HistoryWire {
        session_id: String,
        messages: Vec<serde_json::Value>,
    }
    #[derive(Deserialize)]
    struct TextWire {
        session_id: String,
        text: String,
    }
    #[derive(Deserialize)]
    struct ToolStartWire {
        session_id: String,
        call_id: String,
        name: String,
    }
    #[derive(Deserialize)]
    struct ToolInputWire {
        session_id: String,
        call_id: String,
        delta: String,
    }
    #[derive(Deserialize)]
    struct ToolDoneWire {
        session_id: String,
        call_id: String,
        name: String,
        output: String,
        #[serde(default)]
        error: Option<String>,
    }
    #[derive(Deserialize)]
    struct ImagesWire {
        session_id: String,
        images: Vec<serde_json::Value>,
    }
    #[derive(Deserialize)]
    struct TokenUsageWire {
        session_id: String,
        input: u64,
        output: u64,
        #[serde(default)]
        cache_read_input: Option<u64>,
    }
    #[derive(Deserialize)]
    struct WakeWire {
        session_id: String,
        reason: String,
    }
    #[derive(Deserialize)]
    struct BgProgressWire {
        session_id: String,
        task_id: String,
        summary: String,
        #[serde(default)]
        label: Option<String>,
        #[serde(default)]
        percent: Option<f32>,
        #[serde(default)]
        done: bool,
    }
    #[derive(Deserialize)]
    struct PermissionWire {
        session_id: String,
        request_id: String,
        tool_name: String,
        #[serde(default)]
        description: Option<String>,
    }
    #[derive(Deserialize)]
    struct StatusWire {
        session_id: String,
        status: String,
    }
    #[derive(Deserialize)]
    struct PhaseWire {
        session_id: String,
        phase: String,
    }
    #[derive(Deserialize)]
    struct ModelInfoWire {
        session_id: String,
        #[serde(default)]
        provider: Option<String>,
        #[serde(default)]
        model: Option<String>,
        #[serde(default)]
        reasoning_effort: Option<String>,
    }
    #[derive(Deserialize)]
    struct ModelsWire {
        session_id: String,
        models: Vec<String>,
        #[serde(default)]
        current: Option<String>,
    }
    #[derive(Deserialize)]
    struct RuntimeInfoWire {
        session_id: String,
        #[serde(default)]
        provider: Option<String>,
        #[serde(default)]
        model: Option<String>,
        #[serde(default)]
        routes: Vec<RouteWire>,
    }
    #[derive(Deserialize)]
    struct RouteWire {
        model: String,
        provider: String,
        #[serde(default)]
        available: Option<bool>,
    }
    #[derive(Deserialize)]
    struct CredentialWire {
        provider: String,
        configured: bool,
    }
    #[derive(Deserialize)]
    struct CompactedWire {
        session_id: String,
        #[serde(default)]
        message: Option<String>,
    }
    #[derive(Deserialize)]
    struct RenamedWire {
        session_id: String,
        display_title: String,
    }

    let session = |w: SessionBriefWire| -> Result<SessionBrief, JcodeError> {
        Ok(SessionBrief {
            session_id: SessionId::new(w.session_id)?,
            status: w.status.map(Content::new),
            title: w.title.map(Content::new),
        })
    };
    let sid = |w: SessionRef| SessionId::new(w.session_id);

    let event = match kind_raw {
        "hello_ok" => {
            let w: HelloOkWire = payload!(HelloOkWire, &value, "hello_ok payload");
            EventKind::HelloOk {
                negotiated_major: w.version,
                server: Content::new(w.server),
                capabilities: w
                    .capabilities
                    .into_iter()
                    .take(MAX_LIST_ITEMS)
                    .map(|c| bounded(&redact(&c), 64))
                    .collect(),
            }
        }
        "ok" => EventKind::Ok,
        "error" => {
            let w: ErrorWire = payload!(ErrorWire, &value, "error payload");
            EventKind::RemoteError {
                code: RemoteErrorCode::from_wire(&w.code),
                message: Content::new(w.message),
            }
        }
        "sessions" => {
            let w: SessionsWire = payload!(SessionsWire, &value, "sessions payload");
            let truncated = w.sessions.len() > MAX_LIST_ITEMS;
            let mut out = Vec::new();
            for s in w.sessions.into_iter().take(MAX_LIST_ITEMS) {
                out.push(session(s)?);
            }
            EventKind::Sessions { sessions: out, truncated }
        }
        "attached" => {
            let w: AttachedWire = payload!(AttachedWire, &value, "attached payload");
            EventKind::Attached { session: session(w.session)?, forked: false }
        }
        "session_forked" => {
            let w: AttachedWire = payload!(AttachedWire, &value, "session_forked payload");
            EventKind::Attached { session: session(w.session)?, forked: true }
        }
        "history" => {
            let w: HistoryWire = payload!(HistoryWire, &value, "history payload");
            EventKind::History {
                session_id: SessionId::new(w.session_id)?,
                message_count: w.messages.len() as u64,
            }
        }
        "pong" => EventKind::Pong,
        "text_delta" => {
            let w: TextWire = payload!(TextWire, &value, "text_delta payload");
            EventKind::TextDelta { session_id: SessionId::new(w.session_id)?, text: Content::new(w.text) }
        }
        "reasoning_delta" => {
            let w: TextWire = payload!(TextWire, &value, "reasoning_delta payload");
            EventKind::ReasoningDelta { session_id: SessionId::new(w.session_id)?, text: Content::new(w.text) }
        }
        "reasoning_done" => {
            let w: SessionRef = payload!(SessionRef, &value, "reasoning_done payload");
            EventKind::ReasoningDone { session_id: sid(w)? }
        }
        "tool_start" => {
            let w: ToolStartWire = payload!(ToolStartWire, &value, "tool_start payload");
            EventKind::ToolCallStart {
                session_id: SessionId::new(w.session_id)?,
                call_id: ToolCallId::new(w.call_id)?,
                name: Content::new(w.name),
                executing: false,
            }
        }
        "tool_exec" => {
            let w: ToolStartWire = payload!(ToolStartWire, &value, "tool_exec payload");
            EventKind::ToolCallStart {
                session_id: SessionId::new(w.session_id)?,
                call_id: ToolCallId::new(w.call_id)?,
                name: Content::new(w.name),
                executing: true,
            }
        }
        "tool_input_delta" => {
            let w: ToolInputWire = payload!(ToolInputWire, &value, "tool_input_delta payload");
            EventKind::ToolCallInput {
                session_id: SessionId::new(w.session_id)?,
                call_id: ToolCallId::new(w.call_id)?,
                delta: Content::new(w.delta),
            }
        }
        "tool_done" => {
            let w: ToolDoneWire = payload!(ToolDoneWire, &value, "tool_done payload");
            EventKind::ToolCallDone {
                session_id: SessionId::new(w.session_id)?,
                call_id: ToolCallId::new(w.call_id)?,
                name: Content::new(w.name),
                output: Content::new(w.output),
                error: w.error.map(Content::new),
            }
        }
        "side_pane_images" => {
            let w: ImagesWire = payload!(ImagesWire, &value, "side_pane_images payload");
            EventKind::MediaAvailable {
                session_id: SessionId::new(w.session_id)?,
                count: w.images.len() as u64,
            }
        }
        "token_usage" => {
            let w: TokenUsageWire = payload!(TokenUsageWire, &value, "token_usage payload");
            EventKind::TokenUsage {
                session_id: SessionId::new(w.session_id)?,
                input: w.input,
                output: w.output,
                cache_read_input: w.cache_read_input,
            }
        }
        "turn_done" => {
            let w: SessionRef = payload!(SessionRef, &value, "turn_done payload");
            EventKind::TurnCompleted { session_id: sid(w)? }
        }
        "message_accepted" => {
            let w: SessionRef = payload!(SessionRef, &value, "message_accepted payload");
            EventKind::MessageAccepted { session_id: sid(w)? }
        }
        "permission_request" => {
            let w: PermissionWire = payload!(PermissionWire, &value, "permission_request payload");
            EventKind::PermissionRequested {
                session_id: SessionId::new(w.session_id)?,
                request_id: PermissionRequestId::new(w.request_id)?,
                tool_name: Content::new(w.tool_name),
                description: w.description.map(Content::new),
            }
        }
        "session_status" => {
            let w: StatusWire = payload!(StatusWire, &value, "session_status payload");
            EventKind::StatusChanged { session_id: SessionId::new(w.session_id)?, status: Content::new(w.status) }
        }
        "connection_phase" => {
            let w: PhaseWire = payload!(PhaseWire, &value, "connection_phase payload");
            EventKind::ConnectionPhase { session_id: SessionId::new(w.session_id)?, phase: Content::new(w.phase) }
        }
        "model_info" => {
            let w: ModelInfoWire = payload!(ModelInfoWire, &value, "model_info payload");
            EventKind::ModelInfo {
                session_id: SessionId::new(w.session_id)?,
                provider: w.provider.map(Content::new),
                model: w.model.map(Content::new),
                effort: w.reasoning_effort.map(Content::new),
            }
        }
        "models" => {
            let w: ModelsWire = payload!(ModelsWire, &value, "models payload");
            let truncated = w.models.len() > MAX_LIST_ITEMS;
            EventKind::ModelsListed {
                session_id: SessionId::new(w.session_id)?,
                models: w.models.into_iter().take(MAX_LIST_ITEMS).collect(),
                current: w.current,
                truncated,
            }
        }
        "runtime_info" => {
            let w: RuntimeInfoWire = payload!(RuntimeInfoWire, &value, "runtime_info payload");
            let truncated = w.routes.len() > MAX_LIST_ITEMS;
            EventKind::RuntimeInfo {
                session_id: SessionId::new(w.session_id)?,
                provider: w.provider.map(Content::new),
                model: w.model.map(Content::new),
                routes: w
                    .routes
                    .into_iter()
                    .take(MAX_LIST_ITEMS)
                    .map(|r| RouteInfo {
                        model: Content::new(r.model),
                        provider: Content::new(r.provider),
                        available: r.available,
                    })
                    .collect(),
                truncated,
            }
        }
        "credential_updated" => {
            let w: CredentialWire = payload!(CredentialWire, &value, "credential_updated payload");
            EventKind::CredentialUpdated { provider: Content::new(w.provider), configured: w.configured }
        }
        "compacted" => {
            let w: CompactedWire = payload!(CompactedWire, &value, "compacted payload");
            EventKind::Compacted {
                session_id: SessionId::new(w.session_id)?,
                message: w.message.map(Content::new),
            }
        }
        "session_renamed" => {
            let w: RenamedWire = payload!(RenamedWire, &value, "session_renamed payload");
            EventKind::SessionRenamed {
                session_id: SessionId::new(w.session_id)?,
                display_title: Content::new(w.display_title),
            }
        }
        "wake_requested" => {
            let w: WakeWire = payload!(WakeWire, &value, "wake_requested payload");
            EventKind::WakeRequested {
                session_id: SessionId::new(w.session_id)?,
                reason: Content::new(w.reason),
            }
        }
        "background_progress" => {
            let w: BgProgressWire = payload!(BgProgressWire, &value, "background_progress payload");
            EventKind::BackgroundProgress {
                session_id: SessionId::new(w.session_id)?,
                task_id: TaskId::new(w.task_id)?,
                label: w.label.map(Content::new),
                percent: w.percent,
                done: w.done,
            }
        }
        // Recognized on the wire, deliberately not carried in Milestone One.
        "file_content" | "files" | "text_matches" | "file_status" => {
            EventKind::UncarriedKnown { kind: kind_bounded }
        }
        _ => EventKind::Unknown { kind: kind_bounded },
    };
    Ok(event)
}

/// Decode one NDJSON line (without its terminator) into a frame view.
///
/// Fail-closed rules, in order: control bytes → malformed; not an object →
/// malformed; missing/wrong `v` → missing-field / protocol-version error;
/// missing `ev` → missing-field; payload violations → missing-field.
pub fn decode_frame_line(line: &str) -> Result<ServerFrameView, JcodeError> {
    let line = line.trim_end_matches(['\r', '\n']);
    let trimmed = line.trim_matches([' ', '\t']);
    if trimmed.is_empty() {
        return Err(JcodeError::new(ErrorCode::MalformedFrame, "blank frame"));
    }
    if trimmed.bytes().any(|b| (b < 0x20) || b == 0x7f) {
        return Err(JcodeError::new(
            ErrorCode::MalformedFrame,
            "frame contains control bytes (terminal output and ANSI escapes are never protocol)",
        ));
    }
    let value: serde_json::Value = serde_json::from_str(trimmed).map_err(|e| {
        JcodeError::new(ErrorCode::MalformedFrame, format!("frame is not valid JSON ({e})"))
    })?;
    if !value.is_object() {
        return Err(JcodeError::new(ErrorCode::MalformedFrame, "frame is not a JSON object"));
    }
    match value.get("v") {
        None => {
            return Err(JcodeError::new(ErrorCode::MissingRequiredField, "frame has no `v` version"));
        }
        Some(v) => {
            let major = v.as_u64().ok_or_else(|| {
                JcodeError::new(ErrorCode::MalformedFrame, "`v` is not an unsigned integer")
            })?;
            if major != u64::from(PROTOCOL_MAJOR) {
                return Err(JcodeError::new(
                    ErrorCode::ProtocolVersionUnsupported,
                    format!(
                        "frame speaks protocol major {major}; Coding Studio implements major {PROTOCOL_MAJOR} only"
                    ),
                ));
            }
        }
    }
    let reply_to = match value.get("reply_to") {
        None => None,
        Some(v) => Some(v.as_u64().ok_or_else(|| {
            JcodeError::new(ErrorCode::MalformedFrame, "`reply_to` is not an unsigned integer")
        })?),
    };
    let event = json_value_to_event(value)?;
    Ok(ServerFrameView { major: PROTOCOL_MAJOR, reply_to, event })
}

/// Bounded NDJSON reader over any `BufRead` (socket, pipe, or in-memory
/// fixture). Reads at most `max_frame_bytes + 1` before deciding, so a
/// newline-free flood cannot allocate beyond the bound.
pub struct FrameDecoder<R> {
    reader: R,
    max_frame_bytes: usize,
    frames_read: u64,
}

impl<R: BufRead> FrameDecoder<R> {
    pub fn new(reader: R) -> Self {
        Self { reader, max_frame_bytes: MAX_FRAME_BYTES, frames_read: 0 }
    }

    #[cfg(test)]
    pub fn with_limit(reader: R, max_frame_bytes: usize) -> Self {
        Self { reader, max_frame_bytes, frames_read: 0 }
    }

    pub fn frames_read(&self) -> u64 {
        self.frames_read
    }

    /// Next frame, `Ok(None)` on clean EOF, `Err` on contract violation.
    /// An oversized frame is unresynchronizable: the error is terminal for
    /// this stream, matching upstream bridge behavior.
    pub fn next_frame(&mut self) -> Result<Option<ServerFrameView>, JcodeError> {
        loop {
            let mut line = String::new();
            let limit = self.max_frame_bytes as u64 + 1;
            let read = (&mut self.reader)
                .take(limit)
                .read_line(&mut line)
                .map_err(JcodeError::from)?;
            if read == 0 {
                return Ok(None);
            }
            if line.trim().is_empty() {
                continue; // blank lines are framing noise, like upstream
            }
            if !line.ends_with('\n') && line.len() as u64 > self.max_frame_bytes as u64 {
                return Err(JcodeError::new(
                    ErrorCode::FrameTooLarge,
                    format!(
                        "frame exceeded {} bytes without a terminator; stream closed (mid-frame resync is impossible)",
                        self.max_frame_bytes
                    ),
                ));
            }
            self.frames_read += 1;
            return decode_frame_line(&line).map(Some);
        }
    }
}

// ---------------------------------------------------------------------------
// Sequencing, duplicate detection, reply and approval correlation
// ---------------------------------------------------------------------------

fn line_fingerprint(trimmed: &str) -> u64 {
    // sha2 is already a dependency: an accidental-replay signal keyed on a
    // real digest cannot be gamed by a colliding hash the way a weak in-memory
    // hasher could.
    use sha2::Digest;
    let digest = sha2::Sha256::digest(trimmed.as_bytes());
    u64::from_le_bytes(digest[..8].try_into().expect("8 bytes"))
}

/// What the sequencer decided about one ingested frame.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ingress {
    /// Fresh frame, delivered.
    Fresh,
    /// Byte-identical to a frame inside the small adjacency window.
    /// Delivered *and flagged*: upstream has no dedup ids (capability row
    /// "duplicate-event-behavior" is unknown), so exact-adjacency matching is
    /// detection-only. Suppressing would corrupt legitimately repeated
    /// deltas; the stream is never silently mutated.
    DuplicateSuspect,
}

/// Event with its ingest-assigned monotonic sequence number.
#[derive(Clone, Debug)]
pub struct SequencedEvent {
    pub seq: u64,
    pub frame: ServerFrameView,
    /// True when `reply_to` named a request id this connection never sent —
    /// diagnostic only; delivery policy stays with the caller.
    pub stray_reply: bool,
    /// True when the raw frame byte-equals a recent one (possible replay).
    pub duplicate_suspect: bool,
}

/// Per-connection state: monotonic ingest sequencing, bounded adjacent
/// duplicate suppression, outstanding request ids, outstanding approvals.
pub struct EventSequencer {
    next_seq: u64,
    recent: VecDeque<u64>,
    outstanding_requests: HashSet<u64>,
    outstanding_approvals: HashSet<String>,
    duplicates_flagged: u64,
}

impl Default for EventSequencer {
    fn default() -> Self {
        Self::new()
    }
}

impl EventSequencer {
    pub fn new() -> Self {
        Self {
            next_seq: 1,
            recent: VecDeque::with_capacity(DEDUP_WINDOW + 1),
            outstanding_requests: HashSet::new(),
            outstanding_approvals: HashSet::new(),
            duplicates_flagged: 0,
        }
    }

    pub fn duplicates_flagged(&self) -> u64 {
        self.duplicates_flagged
    }

    /// Record an outbound request id (from [`RequestEncoder::encode`]).
    pub fn register_request(&mut self, id: u64) -> Result<(), JcodeError> {
        if self.outstanding_requests.len() >= MAX_OUTSTANDING {
            return Err(JcodeError::new(
                ErrorCode::CapabilityDenied,
                "too many outstanding requests; drain or reconnect",
            ));
        }
        self.outstanding_requests.insert(id);
        Ok(())
    }

    /// Track an approval request the server issued.
    pub fn register_approval(&mut self, request_id: &PermissionRequestId) -> Result<(), JcodeError> {
        if self.outstanding_approvals.len() >= MAX_OUTSTANDING {
            return Err(JcodeError::new(
                ErrorCode::CapabilityDenied,
                "too many outstanding approvals; fail closed",
            ));
        }
        self.outstanding_approvals.insert(request_id.as_str().to_string());
        Ok(())
    }

    /// Consume an approval id when the user answers. Fails closed on any id
    /// the server never asked about (approval spoofing cannot fabricate one).
    pub fn take_approval_for_response(&mut self, request_id: &PermissionRequestId) -> Result<(), JcodeError> {
        if self.outstanding_approvals.remove(request_id.as_str()) {
            Ok(())
        } else {
            Err(JcodeError::new(
                ErrorCode::ApprovalNotOutstanding,
                "approval response references a request id the server never issued (or already answered)",
            ))
        }
    }

    pub fn outstanding_approvals(&self) -> usize {
        self.outstanding_approvals.len()
    }

    /// Hand one decoded frame plus its raw line (terminator stripped) to the
    /// sequencer. Duplicate frames are flagged and delivered, never dropped.
    pub fn ingest(&mut self, raw_line: &str, frame: ServerFrameView) -> (Ingress, SequencedEvent) {
        let fp = line_fingerprint(raw_line);
        let duplicate_suspect = self.recent.contains(&fp);
        self.recent.push_back(fp);
        while self.recent.len() > DEDUP_WINDOW {
            self.recent.pop_front();
        }
        if duplicate_suspect {
            self.duplicates_flagged += 1;
        }
        let stray_reply = match frame.reply_to {
            Some(id) => !self.outstanding_requests.remove(&id),
            None => false,
        };
        // Approval requests self-register so later responses can resolve.
        if let EventKind::PermissionRequested { request_id, .. } = &frame.event {
            // Registration is capped; on cap pressure the event still flows but
            // the approval cannot be answered (fail closed at response time).
            let _ = self.register_approval(request_id);
        }
        let seq = self.next_seq;
        self.next_seq += 1;
        let ingress = if duplicate_suspect { Ingress::DuplicateSuspect } else { Ingress::Fresh };
        (ingress, SequencedEvent { seq, frame, stray_reply, duplicate_suspect })
    }
}

// ---------------------------------------------------------------------------
// Outbound requests
// ---------------------------------------------------------------------------

/// Decisions that may answer a `permission_request`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PermissionDecision {
    Allow,
    AllowAlways,
    Deny,
}

impl PermissionDecision {
    fn as_wire(self) -> &'static str {
        match self {
            Self::Allow => "allow",
            Self::AllowAlways => "allow_always",
            Self::Deny => "deny",
        }
    }
}

/// The requests Coding Studio may send. Deliberately excludes: `set_api_key`
/// (no credential transport in M1), image payloads, file operations, and
/// anything outside the verified surface.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutgoingRequest {
    Hello { client: String },
    ListSessions { include_archived: bool, limit: Option<u32> },
    CreateSession { working_dir: Option<String> },
    AttachSession { session_id: SessionId },
    DetachSession { session_id: SessionId },
    SendMessage { session_id: SessionId, content: String },
    Cancel { session_id: SessionId },
    PermissionResponse { session_id: SessionId, request_id: PermissionRequestId, decision: PermissionDecision },
    Ping,
}

/// Monotonic client frame ids and outbound encoding.
pub struct RequestEncoder {
    next_id: u64,
}

impl Default for RequestEncoder {
    fn default() -> Self {
        Self::new()
    }
}

impl RequestEncoder {
    pub fn new() -> Self {
        Self { next_id: 1 }
    }

    fn alloc(&mut self) -> u64 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    /// Encode a request as one NDJSON line. Returns `(frame id, line)`.
    pub fn encode(&mut self, request: &OutgoingRequest) -> Result<(u64, String), JcodeError> {
        let id = self.alloc();
        let mut frame = serde_json::Map::new();
        frame.insert("v".to_string(), serde_json::json!(PROTOCOL_MAJOR));
        frame.insert("id".to_string(), serde_json::json!(id));
        match request {
            OutgoingRequest::Hello { client } => {
                if client.is_empty()
                    || client.len() > 64
                    || !client
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'/'))
                {
                    return Err(JcodeError::new(
                        ErrorCode::InvalidIdentifier,
                        "client name must be 1..=64 chars of [A-Za-z0-9._/-]",
                    ));
                }
                frame.insert("req".to_string(), serde_json::json!("hello"));
                frame.insert("min_version".to_string(), serde_json::json!(PROTOCOL_MAJOR));
                frame.insert("max_version".to_string(), serde_json::json!(PROTOCOL_MAJOR));
                frame.insert("client".to_string(), serde_json::json!(client));
            }
            OutgoingRequest::ListSessions { include_archived, limit } => {
                frame.insert("req".to_string(), serde_json::json!("list_sessions"));
                if *include_archived {
                    frame.insert("include_archived".to_string(), serde_json::json!(true));
                }
                if let Some(limit) = limit {
                    frame.insert("limit".to_string(), serde_json::json!((*limit).min(4096)));
                }
            }
            OutgoingRequest::CreateSession { working_dir } => {
                frame.insert("req".to_string(), serde_json::json!("create_session"));
                if let Some(dir) = working_dir {
                    frame.insert("working_dir".to_string(), serde_json::json!(dir));
                }
            }
            OutgoingRequest::AttachSession { session_id } => {
                frame.insert("req".to_string(), serde_json::json!("attach_session"));
                frame.insert("session_id".to_string(), serde_json::json!(session_id.as_str()));
            }
            OutgoingRequest::DetachSession { session_id } => {
                frame.insert("req".to_string(), serde_json::json!("detach_session"));
                frame.insert("session_id".to_string(), serde_json::json!(session_id.as_str()));
            }
            OutgoingRequest::SendMessage { session_id, content } => {
                if content.len() > MAX_OUTBOUND_MESSAGE {
                    return Err(JcodeError::new(
                        ErrorCode::PayloadTooLarge,
                        format!("message exceeds the {} byte bound", MAX_OUTBOUND_MESSAGE),
                    ));
                }
                frame.insert("req".to_string(), serde_json::json!("send_message"));
                frame.insert("session_id".to_string(), serde_json::json!(session_id.as_str()));
                frame.insert("content".to_string(), serde_json::json!(content));
            }
            OutgoingRequest::Cancel { session_id } => {
                frame.insert("req".to_string(), serde_json::json!("cancel"));
                frame.insert("session_id".to_string(), serde_json::json!(session_id.as_str()));
            }
            OutgoingRequest::PermissionResponse { session_id, request_id, decision } => {
                frame.insert("req".to_string(), serde_json::json!("permission_response"));
                frame.insert("session_id".to_string(), serde_json::json!(session_id.as_str()));
                frame.insert("request_id".to_string(), serde_json::json!(request_id.as_str()));
                frame.insert("decision".to_string(), serde_json::json!(decision.as_wire()));
            }
            OutgoingRequest::Ping => {
                frame.insert("req".to_string(), serde_json::json!("ping"));
            }
        }
        let mut line = serde_json::to_string(&serde_json::Value::Object(frame)).map_err(|e| {
            JcodeError::new(ErrorCode::Internal, format!("request serialization failed ({e})"))
        })?;
        line.push('\n');
        Ok((id, line))
    }
}

// ---------------------------------------------------------------------------
// Stream classification (stdout = protocol, stderr = diagnostics, never TUI)
// ---------------------------------------------------------------------------

/// What a byte stream actually is, judged structurally (ADR-0005).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StreamClass {
    /// Valid single-line JSON object string — eligible for frame decoding.
    Protocol,
    /// Human-readable diagnostics: carried as bounded redacted text only.
    Diagnostics,
    /// Contains terminal control bytes (ANSI/VT escapes et al.): could be TUI
    /// render output — never enters the event path.
    TerminalControl,
}

/// Classify raw bytes from any child-process stream.
pub fn classify_stream_bytes(bytes: &[u8]) -> StreamClass {
    if bytes
        .iter()
        .any(|b| (*b < 0x20 && !matches!(*b, b'\n' | b'\r' | b'\t')) || *b == 0x7f)
    {
        return StreamClass::TerminalControl;
    }
    let text = match std::str::from_utf8(bytes) {
        Ok(t) => t,
        Err(_) => return StreamClass::Diagnostics,
    };
    let line = text.trim();
    if line.is_empty() {
        return StreamClass::Diagnostics;
    }
    match serde_json::from_str::<serde_json::Value>(line) {
        Ok(v) if v.is_object() => StreamClass::Protocol,
        _ => StreamClass::Diagnostics,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn decode(s: &str) -> Result<ServerFrameView, JcodeError> {
        decode_frame_line(s)
    }

    #[test]
    fn hello_ok_decodes_with_capabilities() {
        let v = decode(r#"{"v":1,"reply_to":1,"ev":"hello_ok","version":1,"server":"jcode-harness-api-bridge/0.1.0","capabilities":["sessions","streaming"]}"#).unwrap();
        assert_eq!(v.reply_to, Some(1));
        match v.event {
            EventKind::HelloOk { negotiated_major, capabilities, .. } => {
                assert_eq!(negotiated_major, 1);
                assert_eq!(capabilities, vec!["sessions", "streaming"]);
            }
            other => panic!("unexpected: {other:?}"),
        }
    }

    #[test]
    fn all_supported_normalized_events_decode() {
        let cases = [
            (r#"{"v":1,"reply_to":2,"ev":"ok"}"#, "ok"),
            (r#"{"v":1,"reply_to":2,"ev":"error","code":"unknown_session","message":"no such session"}"#, "error"),
            (r#"{"v":1,"reply_to":2,"ev":"sessions","sessions":[{"session_id":"s-1","status":"idle"}]}"#, "sessions"),
            (r#"{"v":1,"reply_to":2,"ev":"attached","session":{"session_id":"s-1","status":"idle"}}"#, "attached"),
            (r#"{"v":1,"reply_to":2,"ev":"session_forked","session":{"session_id":"s-2"}}"#, "attached"),
            (r#"{"v":1,"reply_to":2,"ev":"history","session_id":"s-1","messages":[{"role":"user","content":"hi"}]}"#, "history"),
            (r#"{"v":1,"reply_to":2,"ev":"pong"}"#, "pong"),
            (r#"{"v":1,"ev":"text_delta","session_id":"s-1","text":"Hello"}"#, "text_delta"),
            (r#"{"v":1,"ev":"reasoning_delta","session_id":"s-1","text":"thinking"}"#, "reasoning_delta"),
            (r#"{"v":1,"ev":"reasoning_done","session_id":"s-1","duration_secs":1.2}"#, "reasoning_done"),
            (r#"{"v":1,"ev":"tool_start","session_id":"s-1","call_id":"c-1","name":"read"}"#, "tool_call_start"),
            (r#"{"v":1,"ev":"tool_exec","session_id":"s-1","call_id":"c-1","name":"read"}"#, "tool_call_start"),
            (r#"{"v":1,"ev":"tool_input_delta","session_id":"s-1","call_id":"c-1","delta":"{\"path\":"}"#, "tool_call_input"),
            (r#"{"v":1,"ev":"tool_done","session_id":"s-1","call_id":"c-1","name":"read","output":"data","error":null}"#, "tool_call_done"),
            (r#"{"v":1,"ev":"side_pane_images","session_id":"s-1","images":[{"media_type":"image/png","data":"iVBOR","label":null,"source":{"kind":"other","role":"tool"}}]}"#, "media_available"),
            (r#"{"v":1,"ev":"token_usage","session_id":"s-1","input":10,"output":20,"cache_read_input":5}"#, "token_usage"),
            (r#"{"v":1,"ev":"turn_done","session_id":"s-1"}"#, "turn_completed"),
            (r#"{"v":1,"ev":"message_accepted","session_id":"s-1"}"#, "message_accepted"),
            (r#"{"v":1,"ev":"permission_request","session_id":"s-1","request_id":"pr-1","tool_name":"bash","description":"run ls"}"#, "permission_requested"),
            (r#"{"v":1,"ev":"session_status","session_id":"s-1","status":"generating"}"#, "status_changed"),
            (r#"{"v":1,"ev":"connection_phase","session_id":"s-1","phase":"streaming"}"#, "connection_phase"),
            (r#"{"v":1,"ev":"model_info","session_id":"s-1","provider":"anthropic","model":"claude-sonnet-4-20250514","reasoning_effort":"high"}"#, "model_info"),
            (r#"{"v":1,"reply_to":3,"ev":"models","session_id":"s-1","models":["a","b"],"current":"a"}"#, "models_listed"),
            (r#"{"v":1,"ev":"runtime_info","session_id":"s-1","provider":"anthropic","model":"claude-sonnet-4-20250514","routes":[{"model":"m1","provider":"p1","api_method":"oauth","available":true,"detail":"ok"}]}"#, "runtime_info"),
            (r#"{"v":1,"ev":"credential_updated","provider":"anthropic","configured":true}"#, "credential_updated"),
            (r#"{"v":1,"ev":"compacted","session_id":"s-1","message":"scheduled"}"#, "compacted"),
            (r#"{"v":1,"ev":"session_renamed","session_id":"s-1","display_title":"Fix the bug"}"#, "session_renamed"),
            (r#"{"v":1,"ev":"wake_requested","session_id":"s-1","reason":"timer","notification":"wake"}"#, "wake_requested"),
            (r#"{"v":1,"ev":"background_progress","session_id":"s-1","task_id":"bg-1","label":"bash","percent":42.0,"summary":"42% · Running tests","done":false}"#, "background_progress"),
            (r#"{"v":1,"reply_to":9,"ev":"file_content","session_id":"s-1","path":"x","content":"...","size":3,"truncated":false}"#, "uncarried_known"),
            (r#"{"v":1,"reply_to":9,"ev":"files","session_id":"s-1","paths":["a"]}"#, "uncarried_known"),
            (r#"{"v":1,"reply_to":9,"ev":"text_matches","session_id":"s-1","matches":[]}"#, "uncarried_known"),
            (r#"{"v":1,"reply_to":9,"ev":"file_status","session_id":"s-1","path":"x","exists":true,"kind":"file"}"#, "uncarried_known"),
        ];
        for (line, expected) in cases {
            let v = decode(line).unwrap_or_else(|e| panic!("{expected} failed: {e}"));
            assert_eq!(v.event.name(), expected, "for line {line}");
        }
    }

    #[test]
    fn unknown_event_kind_is_bounded_and_payload_dropped() {
        let long_kind = "x".repeat(500);
        let line = format!(r#"{{"v":1,"ev":"{long_kind}","secret":"sk-test123"}}"#);
        let v = decode(&line).unwrap();
        match v.event {
            EventKind::Unknown { kind } => {
                assert!(kind.len() <= MAX_KIND_LEN + 20);
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn additive_future_fields_are_tolerated() {
        // A newer minor adds fields; known kinds must still decode.
        let v = decode(r#"{"v":1,"reply_to":2,"ev":"ok","brand_new_field":{"nested":true}}"#).unwrap();
        assert_eq!(v.event, EventKind::Ok);
    }

    #[test]
    fn malformed_frames_fail_closed() {
        for (i, bad) in [
            "not json",
            "[1,2,3]",
            "\"string\"",
            r#"{"ev":"ok"}"#,                          // missing v
            r#"{"v":"1","ev":"ok"}"#,                 // v wrong type
            r#"{"v":1.5,"ev":"ok"}"#,                 // v not unsigned
            r#"{"v":2,"ev":"ok"}"#,                   // future major: fail closed
            r#"{"v":0,"ev":"ok"}"#,                   // ancient major
            r#"{"v":1}"#,                             // missing ev
            r#"{"v":1,"ev":"text_delta","session_id":"s"}"#, // missing text
            r#"{"v":1,"ev":"text_delta","text":"x"}"#,       // missing session_id
            r#"{"v":1,"reply_to":"x","ev":"ok"}"#,    // reply_to wrong type
        ]
        .iter()
        .enumerate()
        {
            assert!(decode(bad).is_err(), "case {i} must fail: {bad}");
        }
        let err = decode(r#"{"v":2,"ev":"ok"}"#).unwrap_err();
        assert_eq!(err.code(), ErrorCode::ProtocolVersionUnsupported);
        assert!(decode(r#"{"v":1,"ev":"ok"}"#).is_ok());
    }

    #[test]
    fn identifiers_are_validated() {
        assert!(SessionId::new("s-2026_09.05:abc@def").is_ok());
        let too_long = "x".repeat(129);
        for bad in ["", "with space", "with/slash", "with\\backslash", "semi;colon", too_long.as_str()] {
            assert!(SessionId::new(bad).is_err(), "accepted {bad:?}");
        }
        assert!(PermissionRequestId::new("pr-1").is_ok());
        assert!(TaskId::new("bg-1").is_ok());
    }

    #[test]
    fn decoder_bounds_reads_and_rejects_oversize() {
        // 5 MiB single-line frame => too large, no 5MiB retained by reader.
        let big = format!("{{\"v\":1,\"ev\":\"text_delta\",\"session_id\":\"s\",\"text\":\"{}\"}}\n", "x".repeat(5 * 1024 * 1024));
        let mut dec = FrameDecoder::with_limit(Cursor::new(big.into_bytes()), 64);
        let err = dec.next_frame().unwrap_err();
        assert_eq!(err.code(), ErrorCode::FrameTooLarge);

        // A well-formed frame under the small test limit still decodes.
        let ok = "{\"v\":1,\"reply_to\":1,\"ev\":\"ok\"}\n";
        let mut dec = FrameDecoder::with_limit(Cursor::new(ok.as_bytes().to_vec()), 1024);
        assert!(dec.next_frame().unwrap().is_some());
        assert!(dec.next_frame().unwrap().is_none(), "clean EOF");
    }

    #[test]
    fn decoder_skips_blank_lines_then_eof_none() {
        let data = "\n\n{\"v\":1,\"ev\":\"pong\"}\n\n";
        let mut dec = FrameDecoder::new(Cursor::new(data.as_bytes().to_vec()));
        let f = dec.next_frame().unwrap().unwrap();
        assert_eq!(f.event, EventKind::Pong);
        assert!(dec.next_frame().unwrap().is_none());
    }

    #[test]
    fn sequencer_assigns_monotonic_seq_and_flags_duplicates() {
        let mut seq = EventSequencer::new();
        let line = r#"{"v":1,"ev":"text_delta","session_id":"s-1","text":"hi"}"#;
        let mut delivered = Vec::new();
        for _ in 0..3 {
            let frame = decode_frame_line(line).unwrap();
            let (ingress, ev) = seq.ingest(line, frame);
            delivered.push((ingress, ev.seq, ev.duplicate_suspect));
        }
        // Delivery is never mutated (legitimately repeated deltas survive) —
        // duplicates are surfaced, counted, and flagged instead.
        assert_eq!(
            delivered,
            vec![
                (Ingress::Fresh, 1, false),
                (Ingress::DuplicateSuspect, 2, true),
                (Ingress::DuplicateSuspect, 3, true),
            ]
        );
        assert_eq!(seq.duplicates_flagged(), 2);
        // A different frame interleaved, then a replay inside the window.
        let other_line = r#"{"v":1,"ev":"text_delta","session_id":"s-1","text":"ho"}"#;
        let f2 = decode_frame_line(other_line).unwrap();
        assert!(matches!(seq.ingest(other_line, f2).0, Ingress::Fresh));
        let f3 = decode_frame_line(line).unwrap();
        let (ingress, ev) = seq.ingest(line, f3);
        assert_eq!(ingress, Ingress::DuplicateSuspect);
        assert!(ev.duplicate_suspect);
        // A later distinct frame keeps sequencing.
        let third = r#"{"v":1,"ev":"turn_done","session_id":"s-1"}"#;
        let f4 = decode_frame_line(third).unwrap();
        let (ingress, ev) = seq.ingest(third, f4);
        assert_eq!(ingress, Ingress::Fresh);
        assert_eq!(ev.seq, 6);
    }

    #[test]
    fn stray_replies_are_flagged_not_trusted() {
        let mut seq = EventSequencer::new();
        let line = r#"{"v":1,"reply_to":77,"ev":"ok"}"#;
        let frame = decode_frame_line(line).unwrap();
        let (_, ev) = seq.ingest(line, frame);
        assert!(ev.stray_reply, "reply_to an unknown request id must flag");
        seq.register_request(88).unwrap();
        let line2 = r#"{"v":1,"reply_to":88,"ev":"ok"}"#;
        let frame2 = decode_frame_line(line2).unwrap();
        let (_, ev2) = seq.ingest(line2, frame2);
        assert!(!ev2.stray_reply);
        // Same reply twice: the id is no longer outstanding AND the bytes match
        // the window — flagged on both channels, still delivered.
        let frame3 = decode_frame_line(line2).unwrap();
        let (ingress, ev3) = seq.ingest(line2, frame3);
        assert_eq!(ingress, Ingress::DuplicateSuspect);
        assert!(ev3.stray_reply, "second resolution of the same id is stray");
    }

    #[test]
    fn approvals_fail_closed_on_spoofed_ids() {
        let mut seq = EventSequencer::new();
        let req_line = r#"{"v":1,"ev":"permission_request","session_id":"s-1","request_id":"pr-9","tool_name":"bash","description":"rm -rf /tmp/x"}"#;
        let frame = decode_frame_line(req_line).unwrap();
        seq.ingest(req_line, frame);
        assert_eq!(seq.outstanding_approvals(), 1);
        let good = PermissionRequestId::new("pr-9").unwrap();
        assert!(seq.take_approval_for_response(&good).is_ok());
        assert_eq!(seq.outstanding_approvals(), 0);
        let spoof = PermissionRequestId::new("pr-evil").unwrap();
        let err = seq.take_approval_for_response(&spoof).unwrap_err();
        assert_eq!(err.code(), ErrorCode::ApprovalNotOutstanding);
    }

    #[test]
    fn encoder_emits_documented_wire_shapes() {
        let mut enc = RequestEncoder::new();
        let (id, line) = enc.encode(&OutgoingRequest::Hello { client: "coding-studio/0.1.0".into() }).unwrap();
        assert_eq!(id, 1);
        assert!(line.ends_with('\n'));
        let v: serde_json::Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(v["v"], 1);
        assert_eq!(v["req"], "hello");
        assert_eq!(v["min_version"], 1);
        assert_eq!(v["max_version"], 1);

        let sid = SessionId::new("s-1").unwrap();
        let (_, line) = enc.encode(&OutgoingRequest::SendMessage { session_id: sid.clone(), content: "hi".into() }).unwrap();
        let v: serde_json::Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(v["req"], "send_message");
        assert_eq!(v["session_id"], "s-1");
        assert!(v.get("images").is_none(), "omit empty fields like upstream");

        let (_, line) = enc
            .encode(&OutgoingRequest::PermissionResponse {
                session_id: sid.clone(),
                request_id: PermissionRequestId::new("pr-1").unwrap(),
                decision: PermissionDecision::AllowAlways,
            })
            .unwrap();
        let v: serde_json::Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(v["req"], "permission_response");
        assert_eq!(v["decision"], "allow_always");

        let (_, line) = enc.encode(&OutgoingRequest::Cancel { session_id: sid.clone() }).unwrap();
        assert!(line.contains(r#""req":"cancel""#));
        let (_, line) = enc.encode(&OutgoingRequest::Ping).unwrap();
        assert!(line.contains(r#""req":"ping""#));
        assert!(line.contains(r#""id":5"#), "fifth frame carries id 5: {line}");
    }

    #[test]
    fn encoder_bounds_and_validates() {
        let mut enc = RequestEncoder::new();
        assert!(enc.encode(&OutgoingRequest::Hello { client: "bad name!".into() }).is_err());
        let big = "x".repeat(MAX_OUTBOUND_MESSAGE + 1);
        let sid = SessionId::new("s").unwrap();
        let err = enc.encode(&OutgoingRequest::SendMessage { session_id: sid, content: big }).unwrap_err();
        assert_eq!(err.code(), ErrorCode::PayloadTooLarge);
    }

    #[test]
    fn stream_classification_never_promotes_tui() {
        assert_eq!(classify_stream_bytes(b"{\"v\":1,\"ev\":\"ok\"}"), StreamClass::Protocol);
        assert_eq!(classify_stream_bytes(b"[windows] Named pipe busy, retrying"), StreamClass::Diagnostics);
        // Colorized TUI frame sample (box drawing + ANSI):
        let tui = b"\x1b[38;5;99m\xe2\x95\xad\xe2\x94\x80 jcode \xe2\x94\x80\xe2\x95\xae\x1b[0m\n\x1b[2mdim status\x1b[0m";
        assert_eq!(classify_stream_bytes(tui), StreamClass::TerminalControl);
        // Truncated multi-byte UTF-8: not protocol, not terminal control.
        assert_eq!(classify_stream_bytes(b"\xef\xbf not utf8"), StreamClass::Diagnostics);
        assert_eq!(classify_stream_bytes(b""), StreamClass::Diagnostics);
    }

    #[test]
    fn debug_display_of_events_is_redacted() {
        let line = r#"{"v":1,"ev":"text_delta","session_id":"s-1","text":"use sk-abcdef123456 then Bearer aaa.bbb.ccc"}"#;
        let frame = decode_frame_line(line).unwrap();
        let dbg = format!("{:?}", frame.event);
        assert!(!dbg.contains("sk-abcdef123456"));
        assert!(!dbg.contains("aaa.bbb.ccc"));
        assert!(dbg.contains("[REDACTED]"));
    }
}
