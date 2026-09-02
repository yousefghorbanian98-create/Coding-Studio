use serde::{Deserialize, Serialize};

/// Stable, serialisable error contract shared with the frontend.
///
/// The `kind` discriminant is the only thing the UI switches on; `message` is
/// diagnostic detail. Never place credentials or full request bodies here.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OllamaError {
    pub kind: OllamaErrorKind,
    pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum OllamaErrorKind {
    /// Ollama is not reachable at the configured address.
    Unavailable,
    /// Reachable, but no models are installed.
    NoModels,
    /// The requested model is not pulled locally.
    ModelNotFound,
    /// The request exceeded the configured timeout.
    Timeout,
    /// The user (or the UI) cancelled the request.
    Cancelled,
    /// Ollama replied with a non-success status.
    Backend,
    /// A reply could not be parsed into the expected shape.
    Protocol,
}

impl OllamaError {
    pub fn new(kind: OllamaErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn unavailable(message: impl Into<String>) -> Self {
        Self::new(OllamaErrorKind::Unavailable, message)
    }

    pub fn backend(message: impl Into<String>) -> Self {
        Self::new(OllamaErrorKind::Backend, message)
    }

    pub fn protocol(message: impl Into<String>) -> Self {
        Self::new(OllamaErrorKind::Protocol, message)
    }

    pub fn timeout(message: impl Into<String>) -> Self {
        Self::new(OllamaErrorKind::Timeout, message)
    }

    pub fn model_not_found(model: &str) -> Self {
        Self::new(
            OllamaErrorKind::ModelNotFound,
            format!("Model '{model}' is not installed"),
        )
    }

    pub fn cancelled() -> Self {
        Self::new(OllamaErrorKind::Cancelled, "Request cancelled")
    }
}

impl std::fmt::Display for OllamaError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.kind, self.message)
    }
}

impl std::error::Error for OllamaError {}

/// Classifies a reqwest failure without leaking URLs or headers.
impl From<reqwest::Error> for OllamaError {
    fn from(error: reqwest::Error) -> Self {
        if error.is_timeout() {
            return Self::timeout("Ollama did not respond in time");
        }
        if error.is_connect() {
            return Self::unavailable("Could not connect to Ollama");
        }
        if error.is_decode() {
            return Self::protocol("Could not decode the Ollama response");
        }
        if let Some(status) = error.status() {
            return Self::backend(format!("Ollama returned HTTP {}", status.as_u16()));
        }
        Self::backend("Ollama request failed")
    }
}

/// Ollama returns `{"error": "..."}` for well-formed failures.
pub fn classify_api_error(status: u16, body: &str, model: Option<&str>) -> OllamaError {
    let detail = serde_json::from_str::<serde_json::Value>(body)
        .ok()
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| error.as_str())
                .map(str::to_owned)
        })
        .unwrap_or_else(|| format!("Ollama returned HTTP {status}"));

    let looks_missing = detail.contains("not found") || detail.contains("try pulling");
    if status == 404 && looks_missing {
        if let Some(model) = model {
            return OllamaError::model_not_found(model);
        }
    }
    OllamaError::backend(detail)
}
