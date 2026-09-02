//! Integration tests for the Ollama adapter.
//!
//! Every test runs against a wiremock server, so CI never needs a real Ollama
//! installation.

use coding_studio_lib::ollama::client::{normalise_endpoint, OllamaClient, DEFAULT_ENDPOINT};
use coding_studio_lib::ollama::error::OllamaErrorKind;
use coding_studio_lib::ollama::types::{ChatMessage, ChatRequest, OllamaEvent};
use tokio_util::sync::CancellationToken;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

fn request(model: &str) -> ChatRequest {
    ChatRequest {
        stream_id: "s1".into(),
        model: model.into(),
        messages: vec![ChatMessage {
            role: "user".into(),
            content: "hello".into(),
        }],
    }
}

async fn collect(client: &OllamaClient, request: ChatRequest) -> Vec<OllamaEvent> {
    let events = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let sink = events.clone();
    client
        .chat_stream(request, CancellationToken::new(), move |event| {
            sink.lock().unwrap().push(event);
        })
        .await;
    let guard = events.lock().unwrap();
    guard.clone()
}

// ---------------------------------------------------------------- endpoint --

#[test]
fn normalises_endpoints() {
    assert_eq!(normalise_endpoint("  "), DEFAULT_ENDPOINT);
    assert_eq!(
        normalise_endpoint("127.0.0.1:11434"),
        "http://127.0.0.1:11434"
    );
    assert_eq!(
        normalise_endpoint("http://localhost:11434/"),
        "http://localhost:11434"
    );
    assert_eq!(
        normalise_endpoint("https://ollama.internal"),
        "https://ollama.internal"
    );
}

#[test]
fn default_endpoint_is_loopback() {
    assert_eq!(DEFAULT_ENDPOINT, "http://127.0.0.1:11434");
}

// ------------------------------------------------------------------ health --

#[tokio::test]
async fn health_reports_reachable_with_version() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/version"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "version": "0.5.1"
        })))
        .mount(&server)
        .await;

    let health = OllamaClient::new(server.uri()).health().await;
    assert!(health.reachable);
    assert_eq!(health.version.as_deref(), Some("0.5.1"));
    assert!(health.error.is_none());
}

#[tokio::test]
async fn health_reports_unavailable_when_nothing_is_listening() {
    // Port 1 is reserved and never bound.
    let health = OllamaClient::new("http://127.0.0.1:1").health().await;
    assert!(!health.reachable);
    assert_eq!(
        health.error.map(|error| error.kind),
        Some(OllamaErrorKind::Unavailable)
    );
}

#[tokio::test]
async fn health_reports_backend_error_on_bad_status() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/version"))
        .respond_with(ResponseTemplate::new(500))
        .mount(&server)
        .await;

    let health = OllamaClient::new(server.uri()).health().await;
    assert!(!health.reachable);
    assert_eq!(
        health.error.map(|error| error.kind),
        Some(OllamaErrorKind::Backend)
    );
}

// ------------------------------------------------------------------ models --

#[tokio::test]
async fn lists_installed_models() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "models": [
                {
                    "name": "llama3.2:3b",
                    "size": 2019393189u64,
                    "modified_at": "2026-08-01T10:00:00Z",
                    "details": {
                        "family": "llama",
                        "parameter_size": "3.2B",
                        "quantization_level": "Q4_K_M"
                    }
                },
                { "name": "bare-model" }
            ]
        })))
        .mount(&server)
        .await;

    let models = OllamaClient::new(server.uri()).models().await.unwrap();
    assert_eq!(models.len(), 2);
    assert_eq!(models[0].id, "llama3.2:3b");
    assert_eq!(models[0].family, "llama");
    assert_eq!(models[0].parameter_size, "3.2B");
    assert_eq!(models[0].size_bytes, 2019393189);
    // Missing details must not break the mapping.
    assert_eq!(models[1].family, "unknown");
    assert_eq!(models[1].parameter_size, "—");
}

#[tokio::test]
async fn empty_model_list_is_returned_as_empty() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({ "models": [] })),
        )
        .mount(&server)
        .await;

    let models = OllamaClient::new(server.uri()).models().await.unwrap();
    assert!(models.is_empty());
}

#[tokio::test]
async fn malformed_tags_payload_is_a_protocol_error() {
    let server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/api/tags"))
        .respond_with(ResponseTemplate::new(200).set_body_string("not json"))
        .mount(&server)
        .await;

    let error = OllamaClient::new(server.uri()).models().await.unwrap_err();
    assert_eq!(error.kind, OllamaErrorKind::Protocol);
}

// -------------------------------------------------------------------- chat --

fn ndjson(lines: &[serde_json::Value]) -> String {
    lines
        .iter()
        .map(|line| line.to_string())
        .collect::<Vec<_>>()
        .join("\n")
        + "\n"
}

#[tokio::test]
async fn streams_chunks_then_done() {
    let server = MockServer::start().await;
    let body = ndjson(&[
        serde_json::json!({ "message": { "role": "assistant", "content": "Hel" }, "done": false }),
        serde_json::json!({ "message": { "role": "assistant", "content": "lo" }, "done": false }),
        serde_json::json!({
            "done": true,
            "done_reason": "stop",
            "eval_count": 12,
            "prompt_eval_count": 5,
            "total_duration": 1_500_000_000u64
        }),
    ]);
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(ResponseTemplate::new(200).set_body_string(body))
        .mount(&server)
        .await;

    let events = collect(&OllamaClient::new(server.uri()), request("llama3.2")).await;

    assert!(matches!(events[0], OllamaEvent::Connecting { .. }));
    let deltas: Vec<_> = events
        .iter()
        .filter_map(|event| match event {
            OllamaEvent::Chunk { delta, .. } => Some(delta.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(deltas.join(""), "Hello");

    match events.last().unwrap() {
        OllamaEvent::Done {
            eval_count,
            total_duration_ms,
            ..
        } => {
            assert_eq!(*eval_count, Some(12));
            // Nanoseconds are converted to milliseconds.
            assert_eq!(*total_duration_ms, Some(1500));
        }
        other => panic!("expected Done, got {other:?}"),
    }
}

#[tokio::test]
async fn tolerates_a_malformed_line_mid_stream() {
    let server = MockServer::start().await;
    let body = format!(
        "{}\nnot-json\n{}\n",
        serde_json::json!({ "message": { "role": "assistant", "content": "a" }, "done": false }),
        serde_json::json!({ "done": true })
    );
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(ResponseTemplate::new(200).set_body_string(body))
        .mount(&server)
        .await;

    let events = collect(&OllamaClient::new(server.uri()), request("llama3.2")).await;
    let deltas: Vec<_> = events
        .iter()
        .filter_map(|event| match event {
            OllamaEvent::Chunk { delta, .. } => Some(delta.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(deltas.join(""), "a");
    assert!(matches!(events.last().unwrap(), OllamaEvent::Done { .. }));
}

#[tokio::test]
async fn missing_model_maps_to_model_not_found() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(ResponseTemplate::new(404).set_body_json(serde_json::json!({
            "error": "model 'ghost' not found, try pulling it first"
        })))
        .mount(&server)
        .await;

    let events = collect(&OllamaClient::new(server.uri()), request("ghost")).await;
    match events.last().unwrap() {
        OllamaEvent::Error { error, .. } => {
            assert_eq!(error.kind, OllamaErrorKind::ModelNotFound);
        }
        other => panic!("expected Error, got {other:?}"),
    }
}

#[tokio::test]
async fn server_error_maps_to_backend() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(ResponseTemplate::new(500).set_body_string("boom"))
        .mount(&server)
        .await;

    let events = collect(&OllamaClient::new(server.uri()), request("llama3.2")).await;
    match events.last().unwrap() {
        OllamaEvent::Error { error, .. } => assert_eq!(error.kind, OllamaErrorKind::Backend),
        other => panic!("expected Error, got {other:?}"),
    }
}

#[tokio::test]
async fn error_line_inside_the_stream_is_surfaced() {
    let server = MockServer::start().await;
    let body = ndjson(&[serde_json::json!({ "error": "model 'x' not found, try pulling it" })]);
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(ResponseTemplate::new(200).set_body_string(body))
        .mount(&server)
        .await;

    let events = collect(&OllamaClient::new(server.uri()), request("x")).await;
    match events.last().unwrap() {
        OllamaEvent::Error { error, .. } => {
            assert_eq!(error.kind, OllamaErrorKind::ModelNotFound)
        }
        other => panic!("expected Error, got {other:?}"),
    }
}

#[tokio::test]
async fn unreachable_daemon_maps_to_unavailable() {
    let events = collect(&OllamaClient::new("http://127.0.0.1:1"), request("llama3.2")).await;
    match events.last().unwrap() {
        OllamaEvent::Error { error, .. } => {
            assert_eq!(error.kind, OllamaErrorKind::Unavailable)
        }
        other => panic!("expected Error, got {other:?}"),
    }
}

#[tokio::test]
async fn done_reason_cancel_is_reported_as_cancelled() {
    let server = MockServer::start().await;
    let body = ndjson(&[serde_json::json!({ "done": true, "done_reason": "cancel" })]);
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(ResponseTemplate::new(200).set_body_string(body))
        .mount(&server)
        .await;

    let events = collect(&OllamaClient::new(server.uri()), request("llama3.2")).await;
    assert!(matches!(
        events.last().unwrap(),
        OllamaEvent::Cancelled { .. }
    ));
}

#[tokio::test]
async fn cancelling_before_the_request_emits_cancelled() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(ResponseTemplate::new(200).set_body_string("{\"done\":true}\n"))
        .mount(&server)
        .await;

    let token = CancellationToken::new();
    token.cancel();

    let events = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let sink = events.clone();
    OllamaClient::new(server.uri())
        .chat_stream(request("llama3.2"), token, move |event| {
            sink.lock().unwrap().push(event);
        })
        .await;

    let guard = events.lock().unwrap();
    assert!(matches!(guard.last().unwrap(), OllamaEvent::Cancelled { .. }));
}

#[tokio::test]
async fn cancelling_mid_stream_stops_early() {
    let server = MockServer::start().await;
    // A slow response gives the test time to cancel while streaming.
    let body = ndjson(&[
        serde_json::json!({ "message": { "role": "assistant", "content": "a" }, "done": false }),
        serde_json::json!({ "done": true }),
    ]);
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_string(body)
                .set_delay(std::time::Duration::from_millis(300)),
        )
        .mount(&server)
        .await;

    let token = CancellationToken::new();
    let cancel_handle = token.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        cancel_handle.cancel();
    });

    let events = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
    let sink = events.clone();
    OllamaClient::new(server.uri())
        .chat_stream(request("llama3.2"), token, move |event| {
            sink.lock().unwrap().push(event);
        })
        .await;

    let guard = events.lock().unwrap();
    assert!(matches!(guard.last().unwrap(), OllamaEvent::Cancelled { .. }));
}

#[tokio::test]
async fn sends_the_model_and_messages_in_the_request_body() {
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/api/chat"))
        .and(wiremock::matchers::body_partial_json(serde_json::json!({
            "model": "llama3.2",
            "stream": true,
            "messages": [{ "role": "user", "content": "hello" }]
        })))
        .respond_with(ResponseTemplate::new(200).set_body_string("{\"done\":true}\n"))
        .expect(1)
        .mount(&server)
        .await;

    let events = collect(&OllamaClient::new(server.uri()), request("llama3.2")).await;
    assert!(matches!(events.last().unwrap(), OllamaEvent::Done { .. }));
}
