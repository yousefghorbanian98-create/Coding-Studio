pub mod client;
pub mod error;
pub mod registry;
pub mod types;

use std::sync::{Arc, RwLock};

use tauri::ipc::Channel;

use client::{no_models_error, normalise_endpoint, OllamaClient, DEFAULT_ENDPOINT};
use error::OllamaError;
use registry::StreamRegistry;
use types::{ChatRequest, HealthStatus, ModelInfo, OllamaEvent};

/// Shared backend state: the configured endpoint plus in-flight streams.
pub struct OllamaState {
    endpoint: RwLock<String>,
    registry: StreamRegistry,
}

impl Default for OllamaState {
    fn default() -> Self {
        Self {
            endpoint: RwLock::new(
                std::env::var("CODING_STUDIO_OLLAMA_URL")
                    .ok()
                    .filter(|value| !value.trim().is_empty())
                    .map(|value| normalise_endpoint(&value))
                    .unwrap_or_else(|| DEFAULT_ENDPOINT.to_string()),
            ),
            registry: StreamRegistry::new(),
        }
    }
}

impl OllamaState {
    pub fn endpoint(&self) -> String {
        self.endpoint
            .read()
            .map(|guard| guard.clone())
            .unwrap_or_else(|error| error.into_inner().clone())
    }

    pub fn set_endpoint(&self, value: &str) -> String {
        let normalised = normalise_endpoint(value);
        if let Ok(mut guard) = self.endpoint.write() {
            *guard = normalised.clone();
        }
        normalised
    }

    pub fn client(&self) -> OllamaClient {
        OllamaClient::new(self.endpoint())
    }

    pub fn registry(&self) -> &StreamRegistry {
        &self.registry
    }
}

pub type SharedOllamaState = Arc<OllamaState>;

/// Probes the daemon. Unreachable is a value, not an error.
#[tauri::command]
pub async fn ollama_health(state: tauri::State<'_, SharedOllamaState>) -> Result<HealthStatus, ()> {
    Ok(state.client().health().await)
}

/// Lists installed models, distinguishing "none installed" from a failure.
#[tauri::command]
pub async fn ollama_models(
    state: tauri::State<'_, SharedOllamaState>,
) -> Result<Vec<ModelInfo>, OllamaError> {
    let models = state.client().models().await?;
    if models.is_empty() {
        return Err(no_models_error());
    }
    Ok(models)
}

/// Returns the configured endpoint.
#[tauri::command]
pub fn ollama_endpoint(state: tauri::State<'_, SharedOllamaState>) -> String {
    state.endpoint()
}

/// Updates the endpoint and returns the normalised value.
#[tauri::command]
pub fn ollama_set_endpoint(state: tauri::State<'_, SharedOllamaState>, endpoint: String) -> String {
    state.set_endpoint(&endpoint)
}

/// Streams a chat completion over a typed channel.
#[tauri::command]
pub async fn ollama_chat(
    state: tauri::State<'_, SharedOllamaState>,
    request: ChatRequest,
    channel: Channel<OllamaEvent>,
) -> Result<(), OllamaError> {
    let stream_id = request.stream_id.clone();
    let token = state.registry().register(&stream_id);
    let client = state.client();

    client
        .chat_stream(request, token, |event| {
            // A closed channel (window gone) must not abort the task.
            let _ = channel.send(event);
        })
        .await;

    state.registry().finish(&stream_id);
    Ok(())
}

/// Cancels an in-flight stream. Returns false when the id is unknown.
#[tauri::command]
pub fn ollama_cancel(state: tauri::State<'_, SharedOllamaState>, stream_id: String) -> bool {
    state.registry().cancel(&stream_id)
}
