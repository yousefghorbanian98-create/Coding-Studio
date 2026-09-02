use std::time::Duration;

use futures_util::StreamExt;
use tokio_util::sync::CancellationToken;

use super::error::{classify_api_error, OllamaError, OllamaErrorKind};
use super::types::{
    ChatRequest, ChatStreamLine, HealthStatus, ModelInfo, OllamaChatBody, OllamaEvent,
    TagsResponse,
};

pub const DEFAULT_ENDPOINT: &str = "http://127.0.0.1:11434";

/// Time allowed to establish a connection / probe health.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
/// Maximum silence between streamed tokens before giving up.
const IDLE_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Debug, Clone)]
pub struct OllamaClient {
    endpoint: String,
    http: reqwest::Client,
}

impl OllamaClient {
    pub fn new(endpoint: impl Into<String>) -> Self {
        let endpoint = normalise_endpoint(&endpoint.into());
        let http = reqwest::Client::builder()
            .connect_timeout(CONNECT_TIMEOUT)
            // No global request timeout: streaming responses are long-lived.
            .build()
            .unwrap_or_default();
        Self { endpoint, http }
    }

    pub fn endpoint(&self) -> &str {
        &self.endpoint
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.endpoint, path)
    }

    /// Probes the daemon. Never returns `Err`: unreachable is a valid state.
    pub async fn health(&self) -> HealthStatus {
        let request = self
            .http
            .get(self.url("/api/version"))
            .timeout(CONNECT_TIMEOUT);

        match request.send().await {
            Ok(response) if response.status().is_success() => {
                let version = response
                    .json::<serde_json::Value>()
                    .await
                    .ok()
                    .and_then(|value| {
                        value
                            .get("version")
                            .and_then(|v| v.as_str())
                            .map(str::to_owned)
                    });
                HealthStatus {
                    reachable: true,
                    endpoint: self.endpoint.clone(),
                    version,
                    error: None,
                }
            }
            Ok(response) => HealthStatus {
                reachable: false,
                endpoint: self.endpoint.clone(),
                version: None,
                error: Some(OllamaError::backend(format!(
                    "Ollama returned HTTP {}",
                    response.status().as_u16()
                ))),
            },
            Err(error) => HealthStatus {
                reachable: false,
                endpoint: self.endpoint.clone(),
                version: None,
                error: Some(OllamaError::from(error)),
            },
        }
    }

    /// Lists locally installed models.
    pub async fn models(&self) -> Result<Vec<ModelInfo>, OllamaError> {
        let response = self
            .http
            .get(self.url("/api/tags"))
            .timeout(CONNECT_TIMEOUT)
            .send()
            .await
            .map_err(OllamaError::from)?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(classify_api_error(status.as_u16(), &body, None));
        }

        let tags = response
            .json::<TagsResponse>()
            .await
            .map_err(|_| OllamaError::protocol("Malformed /api/tags response"))?;

        Ok(tags.models.into_iter().map(ModelInfo::from).collect())
    }

    /// Streams a chat completion, emitting events through `emit`.
    ///
    /// Returns `Ok(())` for both normal completion and cancellation; the
    /// terminal event tells the caller which occurred.
    pub async fn chat_stream<F>(
        &self,
        request: ChatRequest,
        cancel: CancellationToken,
        mut emit: F,
    ) where
        F: FnMut(OllamaEvent),
    {
        let stream_id = request.stream_id.clone();
        emit(OllamaEvent::Connecting {
            stream_id: stream_id.clone(),
        });

        let body = OllamaChatBody {
            model: &request.model,
            messages: &request.messages,
            stream: true,
        };

        let send = self.http.post(self.url("/api/chat")).json(&body).send();

        let response = tokio::select! {
            biased;
            _ = cancel.cancelled() => {
                emit(OllamaEvent::Cancelled { stream_id });
                return;
            }
            result = send => match result {
                Ok(response) => response,
                Err(error) => {
                    emit(OllamaEvent::Error {
                        stream_id,
                        error: OllamaError::from(error),
                    });
                    return;
                }
            },
        };

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            emit(OllamaEvent::Error {
                stream_id,
                error: classify_api_error(status.as_u16(), &body, Some(&request.model)),
            });
            return;
        }

        let mut stream = response.bytes_stream();
        let mut buffer = Vec::<u8>::new();

        loop {
            let next = tokio::select! {
                biased;
                _ = cancel.cancelled() => {
                    emit(OllamaEvent::Cancelled { stream_id });
                    return;
                }
                chunk = tokio::time::timeout(IDLE_TIMEOUT, stream.next()) => match chunk {
                    Ok(chunk) => chunk,
                    Err(_) => {
                        emit(OllamaEvent::Error {
                            stream_id,
                            error: OllamaError::timeout("Ollama stopped sending tokens"),
                        });
                        return;
                    }
                },
            };

            let Some(chunk) = next else { break };

            let bytes = match chunk {
                Ok(bytes) => bytes,
                Err(error) => {
                    emit(OllamaEvent::Error {
                        stream_id,
                        error: OllamaError::from(error),
                    });
                    return;
                }
            };
            buffer.extend_from_slice(&bytes);

            // Ollama streams newline-delimited JSON; a chunk may split a line.
            while let Some(position) = buffer.iter().position(|byte| *byte == b'\n') {
                let line: Vec<u8> = buffer.drain(..=position).collect();
                let line = String::from_utf8_lossy(&line[..line.len() - 1])
                    .trim()
                    .to_string();
                if line.is_empty() {
                    continue;
                }

                match handle_line(&line, &request.model) {
                    LineOutcome::Delta(delta) => emit(OllamaEvent::Chunk {
                        stream_id: stream_id.clone(),
                        delta,
                    }),
                    LineOutcome::Done(done) => {
                        emit(done_event(&stream_id, done));
                        return;
                    }
                    LineOutcome::Failed(error) => {
                        emit(OllamaEvent::Error { stream_id, error });
                        return;
                    }
                    LineOutcome::Skip => {}
                }
            }
        }

        // Stream ended without an explicit `done` line.
        emit(OllamaEvent::Done {
            stream_id,
            eval_count: None,
            prompt_eval_count: None,
            total_duration_ms: None,
        });
    }
}

enum LineOutcome {
    Delta(String),
    Done(ChatStreamLine),
    Failed(OllamaError),
    Skip,
}

fn handle_line(line: &str, model: &str) -> LineOutcome {
    let parsed = match serde_json::from_str::<ChatStreamLine>(line) {
        Ok(parsed) => parsed,
        // A malformed line mid-stream is tolerated rather than fatal.
        Err(_) => return LineOutcome::Skip,
    };

    if let Some(error) = parsed.error {
        let looks_missing = error.contains("not found") || error.contains("try pulling");
        return LineOutcome::Failed(if looks_missing {
            OllamaError::model_not_found(model)
        } else {
            OllamaError::backend(error)
        });
    }

    if parsed.done {
        return LineOutcome::Done(parsed);
    }

    match parsed.message.as_ref().map(|message| message.content.clone()) {
        Some(content) if !content.is_empty() => LineOutcome::Delta(content),
        _ => LineOutcome::Skip,
    }
}

fn done_event(stream_id: &str, line: ChatStreamLine) -> OllamaEvent {
    // Ollama reports `done_reason: "cancel"` when the client disconnects.
    if line.done_reason.as_deref() == Some("cancel") {
        return OllamaEvent::Cancelled {
            stream_id: stream_id.to_string(),
        };
    }
    OllamaEvent::Done {
        stream_id: stream_id.to_string(),
        eval_count: line.eval_count,
        prompt_eval_count: line.prompt_eval_count,
        total_duration_ms: line.total_duration.map(|ns| ns / 1_000_000),
    }
}

/// Trims trailing slashes and defaults a bare host to http://.
pub fn normalise_endpoint(raw: &str) -> String {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return DEFAULT_ENDPOINT.to_string();
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("http://{trimmed}")
    }
}

/// True when the error means "Ollama reachable but nothing installed".
pub fn is_empty_model_list(models: &[ModelInfo]) -> bool {
    models.is_empty()
}

pub fn no_models_error() -> OllamaError {
    OllamaError::new(
        OllamaErrorKind::NoModels,
        "No models are installed. Run `ollama pull llama3.2` to add one.",
    )
}
