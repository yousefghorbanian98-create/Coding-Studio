use serde::{Deserialize, Serialize};

use super::error::OllamaError;

/// Result of probing the Ollama daemon.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HealthStatus {
    pub reachable: bool,
    pub endpoint: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<OllamaError>,
}

/// A model installed locally, normalised for the UI.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub family: String,
    pub parameter_size: String,
    pub quantization: String,
    pub size_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub modified_at: Option<String>,
}

/// Raw `/api/tags` payload.
#[derive(Debug, Deserialize)]
pub struct TagsResponse {
    #[serde(default)]
    pub models: Vec<TagModel>,
}

#[derive(Debug, Deserialize)]
pub struct TagModel {
    pub name: String,
    #[serde(default)]
    pub size: u64,
    #[serde(default)]
    pub modified_at: Option<String>,
    #[serde(default)]
    pub details: Option<TagModelDetails>,
}

#[derive(Debug, Default, Deserialize)]
pub struct TagModelDetails {
    #[serde(default)]
    pub family: Option<String>,
    #[serde(default)]
    pub parameter_size: Option<String>,
    #[serde(default)]
    pub quantization_level: Option<String>,
}

impl From<TagModel> for ModelInfo {
    fn from(model: TagModel) -> Self {
        let details = model.details.unwrap_or_default();
        Self {
            id: model.name.clone(),
            name: model.name,
            family: details.family.unwrap_or_else(|| "unknown".into()),
            parameter_size: details.parameter_size.unwrap_or_else(|| "—".into()),
            quantization: details.quantization_level.unwrap_or_else(|| "—".into()),
            size_bytes: model.size,
            modified_at: model.modified_at,
        }
    }
}

/// A single chat turn sent to Ollama.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Parameters for a streaming chat request.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    /// Correlates the request with its cancellation handle.
    pub stream_id: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
}

#[derive(Debug, Serialize)]
pub(crate) struct OllamaChatBody<'a> {
    pub model: &'a str,
    pub messages: &'a [ChatMessage],
    pub stream: bool,
}

/// One NDJSON line from `/api/chat`.
#[derive(Debug, Deserialize)]
pub struct ChatStreamLine {
    #[serde(default)]
    pub message: Option<ChatMessage>,
    #[serde(default)]
    pub done: bool,
    #[serde(default)]
    pub done_reason: Option<String>,
    #[serde(default)]
    pub eval_count: Option<u32>,
    #[serde(default)]
    pub prompt_eval_count: Option<u32>,
    #[serde(default)]
    pub total_duration: Option<u64>,
    #[serde(default)]
    pub error: Option<String>,
}

/// Events pushed to the frontend over a typed IPC channel.
///
/// Mirrored exactly by the Zod schema in `src/services/ollama/schemas.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum OllamaEvent {
    /// The request has been accepted and the connection is being opened.
    #[serde(rename_all = "camelCase")]
    Connecting { stream_id: String },
    /// A token (or token group) of the assistant reply.
    #[serde(rename_all = "camelCase")]
    Chunk { stream_id: String, delta: String },
    /// The reply finished normally.
    #[serde(rename_all = "camelCase")]
    Done {
        stream_id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        eval_count: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        prompt_eval_count: Option<u32>,
        #[serde(skip_serializing_if = "Option::is_none")]
        total_duration_ms: Option<u64>,
    },
    /// The caller cancelled the request; partial text is kept by the UI.
    #[serde(rename_all = "camelCase")]
    Cancelled { stream_id: String },
    /// The request failed.
    #[serde(rename_all = "camelCase")]
    Error {
        stream_id: String,
        error: OllamaError,
    },
}
