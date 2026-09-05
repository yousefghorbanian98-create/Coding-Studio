//! Milestone One integration tests: replay the fixture corpus through the
//! Jcode compatibility boundary. Deterministic, no network, no credentials,
//! no locally installed Jcode required, and no terminal output is ever
//! parsed as a protocol frame.

use coding_studio_lib::jcode::error::ErrorCode;
use coding_studio_lib::jcode::lifecycle::{
    self, PERMANENTLY_DENIED, ProviderClass, Support, capability, classify_exit,
    classify_provider_label, product_facing, require,
};
use coding_studio_lib::jcode::protocol::{
    self, EventKind, EventSequencer, FrameDecoder, Ingress, OutgoingRequest, PermissionRequestId,
    RequestEncoder, SessionId, StreamClass, classify_stream_bytes,
};
use coding_studio_lib::jcode::verification::{
    self, ChecksumSet, WindowsArch, verify_against_pin,
};
use coding_studio_lib::jcode::version::{
    self, PINNED_CHECKSUMS_FILE_SHA256, VersionCompatibility,
};
use std::io::Cursor;
use std::path::PathBuf;

fn fixture(rel: &str) -> Vec<u8> {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.push("tests/fixtures/jcode");
    p.push(rel);
    std::fs::read(&p).unwrap_or_else(|e| panic!("fixture {rel} unreadable: {e}"))
}

fn fixture_string(rel: &str) -> String {
    String::from_utf8(fixture(rel)).unwrap_or_else(|_| panic!("fixture {rel} is not UTF-8"))
}

fn decode_all(data: &[u8]) -> Vec<protocol::ServerFrameView> {
    let mut dec = FrameDecoder::new(Cursor::new(data.to_vec()));
    let mut out = Vec::new();
    while let Some(frame) = dec.next_frame().expect("fixture must decode") {
        out.push(frame);
    }
    out
}

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

#[test]
fn replays_full_turn_stream_with_monotonic_sequence() {
    let data = fixture("protocol/session-stream.ndjson");
    let text = fixture_string("protocol/session-stream.ndjson");
    let mut seq = EventSequencer::new();
    let mut delivered = Vec::new();
    let mut dec = FrameDecoder::new(Cursor::new(data));
    while let Some(frame) = dec.next_frame().unwrap() {
        let raw = text.lines().nth((dec.frames_read() - 1) as usize).unwrap();
        let (ingress, ev) = seq.ingest(raw, frame);
        assert_eq!(ingress, Ingress::Fresh);
        delivered.push(ev.unwrap());
    }
    assert_eq!(delivered.len(), 13);
    for (i, ev) in delivered.iter().enumerate() {
        assert_eq!(ev.seq, (i + 1) as u64, "seq must be monotonic from 1");
    }
    // Turn shape: attaches before streaming, completes with turn_completed.
    assert_eq!(delivered[0].frame.event.name(), "hello_ok");
    assert_eq!(delivered[1].frame.event.name(), "attached");
    assert_eq!(delivered.last().unwrap().frame.event.name(), "turn_completed");
    // Text deltas accumulate the assistant's message.
    let text: String = delivered
        .iter()
        .filter_map(|e| match &e.frame.event {
            EventKind::TextDelta { text, .. } => Some(text.as_str().to_string()),
            _ => None,
        })
        .collect();
    assert_eq!(text, "Hello from the fixture.");
    // Every session-scoped event belongs to the fixture session.
    for e in &delivered {
        if let Some(sid) = e.frame.event.session_id() {
            assert_eq!(sid.as_str(), "sess-2026-09-05-a01");
        }
    }
}

#[test]
fn replays_tool_call_lifecycle() {
    let frames = decode_all(&fixture("protocol/tool-call.ndjson"));
    let names: Vec<_> = frames.iter().map(|f| f.event.name()).collect();
    assert_eq!(
        names,
        vec!["tool_call_start", "tool_call_input", "tool_call_start", "tool_call_done"]
    );
    match &frames[0].frame.event {
        EventKind::ToolCallStart { executing, call_id, .. } => {
            assert!(!executing);
            assert_eq!(call_id.as_str(), "call-0001");
        }
        other => panic!("unexpected {other:?}"),
    }
    match &frames[3].frame.event {
        EventKind::ToolCallDone { output, error, .. } => {
            assert_eq!(output.as_str(), "pub mod jcode;");
            assert!(error.is_none());
        }
        other => panic!("unexpected {other:?}"),
    }
}

#[test]
fn approval_round_trip_registers_and_resolves_and_spoofs_fail() {
    let frames = decode_all(&fixture("protocol/approval-turn.ndjson"));
    let mut seq = EventSequencer::new();
    let raw = fixture_string("protocol/approval-turn.ndjson");
    let mut request_id = None;
    for (i, frame) in frames.into_iter().enumerate() {
        let (ingress, _) = seq.ingest(raw.lines().nth(i).unwrap(), frame);
        assert_eq!(ingress, Ingress::Fresh);
    }
    // The decoded permission request self-registered.
    for line in raw.lines() {
        let frame = protocol::decode_frame_line(line).unwrap();
        if let EventKind::PermissionRequested { request_id: rid, tool_name, .. } = frame.event {
            assert_eq!(tool_name.as_str(), "bash");
            request_id = Some(rid);
        }
    }
    let rid = request_id.expect("fixture carries an approval");
    assert!(seq.outstanding_approvals() >= 1);

    // Resolving the genuine id works and yields the documented wire shape.
    assert!(seq.take_approval_for_response(&rid).is_ok());
    let mut enc = RequestEncoder::new();
    let (_id, line) = enc
        .encode(&OutgoingRequest::PermissionResponse {
            session_id: SessionId::new("sess-2026-09-05-a01").unwrap(),
            request_id: rid.clone(),
            decision: protocol::PermissionDecision::Allow,
        })
        .unwrap();
    let v: serde_json::Value = serde_json::from_str(line.trim()).unwrap();
    assert_eq!(v["req"], "permission_response");
    assert_eq!(v["request_id"], "perm-77ab");
    assert_eq!(v["decision"], "allow");

    // Replaying the same id or a fabricated id fails closed (no spoofing).
    assert!(seq.take_approval_for_response(&rid).is_err());
    let spoof = PermissionRequestId::new("perm-forged").unwrap();
    let err = seq.take_approval_for_response(&spoof).unwrap_err();
    assert_eq!(err.code(), ErrorCode::ApprovalNotOutstanding);
}

#[test]
fn hello_ok_capabilities_are_checked_deny_by_default() {
    let frames = decode_all(&fixture("protocol/handshake-hello-ok.ndjson"));
    let check = match &frames[0].event {
        EventKind::HelloOk { capabilities, negotiated_major, server } => {
            assert_eq!(*negotiated_major, 1);
            assert!(server.as_str().starts_with("jcode-harness-api-bridge/"));
            lifecycle::check_server_capabilities(capabilities)
        }
        other => panic!("unexpected {other:?}"),
    };
    assert!(check.missing.is_empty(), "pinned bridge advertises all expected capabilities");
    assert!(check.unrecognized.is_empty());
}

#[test]
fn all_structured_error_codes_map() {
    let frames = decode_all(&fixture("protocol/structured-errors.ndjson"));
    let codes: Vec<_> = frames
        .iter()
        .map(|f| match &f.event {
            EventKind::RemoteError { code, .. } => *code,
            other => panic!("unexpected {other:?}"),
        })
        .collect();
    use protocol::RemoteErrorCode as R;
    assert_eq!(
        codes,
        vec![
            R::UnsupportedVersion,
            R::UnknownRequest,
            R::UnknownSession,
            R::InvalidRequest,
            R::Internal
        ]
    );
}

// ---------------------------------------------------------------------------
// Adversarial inputs
// ---------------------------------------------------------------------------

#[test]
fn malformed_fixture_fails_without_panic_line_by_line() {
    let text = fixture_string("protocol/malformed.ndjson");
    let mut errors = 0;
    for line in text.lines() {
        if protocol::decode_frame_line(line).is_err() {
            errors += 1;
        }
    }
    assert_eq!(errors, 5, "every malformed fixture line must fail");
    // Replay through the streaming decoder: the first malformed line errors
    // out cleanly (no panic); further polling must never panic either.
    let mut dec = FrameDecoder::new(Cursor::new(fixture("protocol/malformed.ndjson")));
    assert!(dec.next_frame().is_err());
    let _ = dec.next_frame();
    let _ = dec.next_frame();
}

#[test]
fn missing_required_fields_fail_precisely() {
    let text = fixture_string("protocol/missing-required-field.ndjson");
    let codes: Vec<ErrorCode> = text
        .lines()
        .map(|line| protocol::decode_frame_line(line).unwrap_err().code())
        .collect();
    assert_eq!(
        codes,
        vec![
            ErrorCode::MissingRequiredField, // no v
            ErrorCode::MissingRequiredField, // no ev
            ErrorCode::MissingRequiredField, // text_delta without session_id
            ErrorCode::MissingRequiredField, // permission_request without request_id
        ]
    );
}

#[test]
fn unknown_kinds_are_tolerated_and_bounded() {
    let frames = decode_all(&fixture("protocol/unknown-event.ndjson"));
    assert!(matches!(frames[0].event, EventKind::Unknown { .. }));
    assert!(matches!(frames[1].event, EventKind::TextDelta { .. }), "stream continues after unknown kinds");
}

#[test]
fn duplicate_events_are_flagged_counted_and_never_mutated() {
    let text = fixture_string("protocol/duplicate-event.ndjson");
    let mut seq = EventSequencer::new();
    let mut kinds = Vec::new();
    for line in text.lines() {
        let frame = protocol::decode_frame_line(line).unwrap();
        let (ingress, ev) = seq.ingest(line, frame);
        kinds.push((ingress, ev.frame.event.name(), ev.duplicate_suspect));
    }
    // All frames are delivered — the stream is never silently mutated; the
    // byte-identical repeat is flagged and counted exactly once.
    assert_eq!(
        kinds,
        vec![
            (Ingress::Fresh, "text_delta", false),
            (Ingress::DuplicateSuspect, "text_delta", true),
            (Ingress::Fresh, "turn_completed", false),
        ]
    );
    assert_eq!(seq.duplicates_flagged(), 1);
}

#[test]
fn out_of_order_and_replayed_replies_are_flagged_never_mutated() {
    let text = fixture_string("protocol/out-of-order-reply.ndjson");
    let mut seq = EventSequencer::new();
    let mut saw_stray = false;
    let mut delivered = 0;
    seq.register_request(88).unwrap();
    for line in text.lines() {
        let frame = protocol::decode_frame_line(line).unwrap();
        let (_, ev) = seq.ingest(line, frame);
        delivered += 1;
        if ev.stray_reply {
            saw_stray = true;
        }
    }
    assert!(saw_stray, "a reply to a never-sent request must be flagged");
    assert_eq!(delivered, 3, "out-of-order frames always survive delivery");
    assert_eq!(seq.duplicates_flagged(), 1, "the replayed line is flagged once");
}

#[test]
fn oversized_frame_is_rejected_bounded() {
    // Constructed in code (see PROVENANCE.md): a 4 MiB+ single-line frame.
    let fat = "x".repeat(protocol::MAX_FRAME_BYTES);
    let blob = format!(
        "{{\"v\":1,\"ev\":\"text_delta\",\"session_id\":\"s\",\"text\":\"{fat}\"}}"
    );
    assert!(blob.len() > protocol::MAX_FRAME_BYTES);
    let mut dec = FrameDecoder::new(Cursor::new(blob.into_bytes()));
    let err = dec.next_frame().unwrap_err();
    assert_eq!(err.code(), ErrorCode::FrameTooLarge);
}

#[test]
fn truncated_stream_stops_cleanly_without_fabricating_completion() {
    let frames = decode_all(&fixture("protocol/truncated-stream.ndjson"));
    assert_eq!(frames.len(), 4);
    assert_eq!(frames.last().unwrap().event.name(), "text_delta");
    assert!(
        !frames.iter().any(|f| matches!(f.event, EventKind::TurnCompleted { .. })),
        "a truncated stream must not invent a completion (honest lifecycle state)"
    );
}

#[test]
fn no_terminal_scraping_is_possible() {
    let tui = fixture("protocol/tui-scrape-attempt.bin");
    // The byte stream classifies as terminal control, never protocol.
    assert_eq!(classify_stream_bytes(&tui), StreamClass::TerminalControl);
    // Feeding it to the frame decoder yields errors, not events.
    let mut dec = FrameDecoder::new(Cursor::new(tui.clone()));
    let mut events = 0;
    let mut errors = 0;
    loop {
        match dec.next_frame() {
            Ok(Some(_)) => events += 1,
            Ok(None) => break,
            Err(_) => {
                errors += 1;
                break; // terminal for this stream
            }
        }
    }
    assert_eq!(events, 0, "TUI bytes must never produce protocol events");
    assert!(errors >= 1);
    // Line-by-line: every slice with escapes fails the direct decoder too.
    for chunk in tui.split(|b| *b == b'\n').filter(|c| !c.is_empty()) {
        match std::str::from_utf8(chunk) {
            Ok(s) => assert!(protocol::decode_frame_line(s).is_err()),
            Err(_) => { /* non-UTF8: rejected at stream layer */ }
        }
    }
}

#[test]
fn secret_bearing_stream_never_leaks_through_display() {
    let frames = decode_all(&fixture("protocol/secret-bearing-stream.ndjson"));
    assert_eq!(frames.len(), 3);
    for f in &frames {
        let dbg = format!("{:?}", f.event);
        assert!(!dbg.contains("sk-test0123456789abcdef"), "api key leaked: {dbg}");
        assert!(!dbg.contains("aaa.bbb.ccc"), "bearer token leaked: {dbg}");
        assert!(!dbg.contains("eyJhbGciOiJIUzI1NiJ9"), "jwt leaked: {dbg}");
        assert!(dbg.contains("[REDACTED]"));
    }
    // Raw content remains available in-process for transcript assembly only.
    match &frames[0].event {
        EventKind::TextDelta { text, .. } => assert!(text.as_str().contains("sk-test0123456789abcdef")),
        other => panic!("unexpected {other:?}"),
    }
}

#[test]
fn stdout_and_stderr_channels_never_mix() {
    // Every protocol fixture line classifies as protocol on its data channel.
    for rel in [
        "protocol/handshake-hello-ok.ndjson",
        "protocol/session-stream.ndjson",
        "protocol/tool-call.ndjson",
        "protocol/approval-turn.ndjson",
    ] {
        for line in fixture_string(rel).lines() {
            assert_eq!(classify_stream_bytes(line.as_bytes()), StreamClass::Protocol, "{rel}: {line}");
        }
    }
    // Every stderr fixture line classifies as diagnostics.
    for line in fixture_string("protocol/diagnostics-stderr.txt").lines() {
        assert_eq!(classify_stream_bytes(line.as_bytes()), StreamClass::Diagnostics, "{line}");
    }
}

// ---------------------------------------------------------------------------
// Version / release verification
// ---------------------------------------------------------------------------

#[test]
fn pinned_version_report_is_supported_others_fail_closed() {
    let pinned = version::parse_version_report(&fixture_string("version/v0.81.7.json")).unwrap();
    assert_eq!(version::classify(&pinned), VersionCompatibility::Supported);
    assert!(version::require_supported(&pinned).is_ok());
    assert_eq!(pinned.git_tag.as_deref(), Some("v0.81.7"));

    let older = version::parse_version_report(&fixture_string("version/unsupported-older-v0.80.1.json")).unwrap();
    assert_eq!(version::classify(&older), VersionCompatibility::UnsupportedOlder);
    assert_eq!(
        version::require_supported(&older).unwrap_err().code(),
        ErrorCode::UnsupportedJcodeVersion
    );

    let newer = version::parse_version_report(&fixture_string("version/unknown-newer.json")).unwrap();
    assert_eq!(version::classify(&newer), VersionCompatibility::UnknownNewer);
    assert_eq!(
        version::require_supported(&newer).unwrap_err().code(),
        ErrorCode::UnknownNewerJcodeVersion
    );

    let malformed =
        version::parse_version_report(&fixture_string("version/malformed-missing-semver.json")).unwrap();
    assert_eq!(version::classify(&malformed), VersionCompatibility::Malformed);
    assert!(version::require_supported(&malformed).is_err());
}

#[test]
fn official_sha256sums_fixture_is_byte_exact_and_verifies_all_assets() {
    let bytes = fixture("release/sha256sums-v0.81.7.txt");
    // Independent integrity anchor: the file itself hashes to the value the
    // GitHub API reported for the official release asset.
    use sha2::Digest;
    let digest = sha2::Sha256::digest(&bytes);
    let hex: String = digest.iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(
        hex, PINNED_CHECKSUMS_FILE_SHA256,
        "fixture must equal the official checksum record byte for byte"
    );

    let set = ChecksumSet::parse(&fixture_string("release/sha256sums-v0.81.7.txt")).unwrap();
    assert_eq!(set.len(), 9);
    let v = verify_against_pin(&set).unwrap();
    assert_eq!(v.tag, "v0.81.7");
    assert_eq!(v.matched_assets, 9);

    // Both Windows architectures have the exact recorded digests.
    assert_eq!(
        set.digest_for("jcode-windows-x86_64.exe").unwrap(),
        "b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b"
    );
    assert_eq!(
        set.digest_for("jcode-windows-aarch64.exe").unwrap(),
        "e38ed16c3fb3bae43989c4fe043da7e3240c24bcad95129fad059cf56636c05c"
    );

    // Tampering fails closed.
    let tampered = fixture_string("release/sha256sums-v0.81.7.txt").replace("b5b09dbe", "ffffffff");
    let set = ChecksumSet::parse(&tampered).unwrap();
    assert!(verify_against_pin(&set).is_err());

    // Windows asset naming needed by the future installer and the CI probe.
    assert_eq!(WindowsArch::X86_64.exe_asset_name(), "jcode-windows-x86_64.exe");
    assert_eq!(WindowsArch::AArch64.exe_asset_name(), "jcode-windows-aarch64.exe");
    let url = verification::asset_download_url(WindowsArch::X86_64);
    assert!(url.ends_with("/v0.81.7/jcode-windows-x86_64.exe"));
}

// ---------------------------------------------------------------------------
// Contract policy
// ---------------------------------------------------------------------------

#[test]
fn no_ollama_or_local_runtime_enters_the_contract() {
    for id in PERMANENTLY_DENIED {
        assert_eq!(capability(id), Support::Unsupported);
        assert!(require(id).is_err());
    }
    let pf = product_facing();
    assert!(!pf.iter().any(|id| id.contains("ollama") || id.contains("local")));
    // Even if a runtime info event ever names a local runtime, it classifies
    // as denied — it cannot become a selectable capability.
    assert_eq!(classify_provider_label(Some("ollama")), ProviderClass::DeniedLocalRuntime);
    assert_eq!(
        classify_provider_label(Some("http://127.0.0.1:11434")),
        ProviderClass::DeniedLocalRuntime
    );
}

#[test]
fn unsupported_versions_and_versions_mismatch_fail_closed_end_to_end() {
    // Compose the classification and capability gates like the future M2
    // install supervisor will: unverified build -> nothing protocol-side runs.
    for rel in ["version/unsupported-older-v0.80.1.json", "version/unknown-newer.json"] {
        let report = version::parse_version_report(&fixture_string(rel)).unwrap();
        assert!(version::require_supported(&report).is_err());
    }
}

#[test]
fn hello_handshake_matches_upstream_wire_shape() {
    let mut enc = RequestEncoder::new();
    let (id, line) = enc
        .encode(&OutgoingRequest::Hello { client: "coding-studio/0.1.0".into() })
        .unwrap();
    assert_eq!(id, 1);
    // Exact string, mirroring upstream's schema snapshot test style.
    assert_eq!(
        line,
        "{\"v\":1,\"id\":1,\"req\":\"hello\",\"min_version\":1,\"max_version\":1,\"client\":\"coding-studio/0.1.0\"}\n"
    );
    let (id, line) = enc
        .encode(&OutgoingRequest::Cancel { session_id: SessionId::new("s-1").unwrap() })
        .unwrap();
    assert_eq!(id, 2);
    assert_eq!(line, "{\"v\":1,\"id\":2,\"req\":\"cancel\",\"session_id\":\"s-1\"}\n");
}

#[test]
fn exit_fixtures_drive_the_disposition_model() {
    let normal = fixture_string("exit/normal-exit.json");
    let v: serde_json::Value = serde_json::from_str(&normal).unwrap();
    assert_eq!(classify_exit(v["exit_code"].as_i64().map(|c| c as i32)), lifecycle::ExitDisposition::Clean);
    let abnormal = fixture_string("exit/abnormal-exit.json");
    let v: serde_json::Value = serde_json::from_str(&abnormal).unwrap();
    assert!(matches!(
        classify_exit(v["exit_code"].as_i64().map(|c| c as i32)),
        lifecycle::ExitDisposition::Failed(1)
    ));
    assert_eq!(classify_exit(None), lifecycle::ExitDisposition::ForcedTermination);
}
