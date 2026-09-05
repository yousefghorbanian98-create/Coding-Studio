# Milestone One — Protocol Selection Gate

Verdict: **PASS — gate option 1 satisfied.** Coding Studio integrates through
Jcode's official stable, versioned machine interface (the *harness API*) and
fails closed everywhere else. Terminal scraping is prohibited by ADR-005 and
no code in this milestone reads, parses, or interprets terminal output.

Preference order per mission and outcome:

1. **Official stable SDK or harness API with versioned types — SELECTED.**
   `crates/jcode-harness-api` (protocol major `v = 1`, minor `0`) exposed by
   the `jcode api-bridge` subcommand of the official binary. Type-level Rust
   access exists in-repo (`jcode-sdk`) but is `publish = false` with
   path-only dependencies, so Coding Studio implements the documented wire
   shape in its own narrow module (`src-tauri/src/jcode/`) instead of adopting
   or vendoring upstream crates.
2. Official stable server/client transport — available as the mechanism under
   (1): NDJSON frames over a local transport (Unix socket on Unix, Windows
   named pipe `\\.\pipe\<stem>-<sha256(normalized path)[..16]>` on Windows;
   `crates/jcode-transport`).
3. Official documented JSON headless protocol — exists (`jcode run --ndjson`,
   emitting `text_delta`/`tool_start`/…/`interrupted` records on stdout);
   **retained as secondary evidence** for event vocabulary but not selected:
   it is per-invocation, lacks session/attach semantics and approvals.
4. Visual-TUI-only — **not the case**; had it been, this milestone would have
   blocked with a compatibility-gap report instead of fabricating a protocol.

## The thirteen required answers, evidenced at commit 358226c2 (tag v0.81.7)

1. **Which interface is officially supported for external embedding?**
   The harness API. `crates/jcode-harness-api/src/lib.rs`: *"This crate defines
   the public boundary between the harness and any UI (TUI, desktop, web,
   scripts)."* The standalone client crate adds: *"Desktop2 is built on this
   crate … exercised by a real, shipping client."*
2. **Public or private/unstable?** Public and deliberately curated ("only
   curated, stable surface lives here"). The internal `jcode-protocol` is the
   private surface and is not used.
3. **Compatibility promise?** Additive changes bump `API_VERSION_MINOR`;
   breaking changes bump `API_VERSION_MAJOR` and are negotiated in the
   handshake. Unknown fields must be ignored; unknown event kinds carry an
   `#[serde(other)]` catch-all and must be skipped. Wire shape is locked by
   upstream schema snapshot tests
   (`crates/jcode-harness-api/src/harness_api_tests/schema_snapshot.rs`).
4. **How is protocol version negotiated?** First frame must be
   `{"v":M,"id":N,"req":"hello","min_version":a,"max_version":b,"client":"…"}`
   with `a <= API_VERSION_MAJOR <= b`; the bridge answers
   `hello_ok { version, server, capabilities[] }`, or
   `error { code: unsupported_version }` and closes
   (`crates/jcode-harness-api-server/src/lib.rs` handshake block — verified by
   reading the accept loop, not inferred).
5. **How are sessions identified?** `session_id: String`, created by
   `create_session`, listed by `list_sessions`, attached by
   `attach_session`; persisted transcripts make resume possible.
6. **How are runs correlated?** Every client frame carries a monotonic
   client-chosen `id`; direct replies set `reply_to` to that id. Streaming
   events are not replies; they carry `session_id`. Tool calls carry
   `call_id`; permission requests carry `request_id`.
7. **How are events ordered and deduplicated?** Upstream ordering is the
   ordered byte stream of the socket; there is **no** global sequence number
   on `ServerFrame` v1 and **no** upstream per-event dedup id. Coding Studio
   therefore assigns a monotonically increasing `seq` at ingest and flags
   exact-duplicate consecutive frames as diagnostics (bounded window; never
   silently mutates the stream). Gaps/out-of-order cannot be detected at the
   frame level upstream and are handled at the lifecycle level (Milestone
   Four), e.g. approval resolutions matching outstanding `request_id`s only.
8. **How are tool approvals represented?** Server event
   `permission_request { session_id, request_id, tool_name, description }`;
   client request `permission_response { session_id, request_id, decision:
   allow | allow_always | deny }`.
9. **How is cancellation represented?** Client request `cancel { session_id }`.
   There is **no** dedicated `cancelled`/`interrupted` event in harness v1
   (turn completion arrives as `turn_done`; the headless
   `jcode run --ndjson` surface does emit `{"type":"interrupted"}`). Matrix
   records this split honestly.
10. **How are structured errors represented?** `error { code, message }` with
    `code ∈ { unsupported_version, unknown_request, unknown_session,
    invalid_request, internal }`.
11. **Which streams may contain diagnostics?** On the protocol channel every
    line is a JSON frame or a hard error; human/operator diagnostics go to the
    bridge/daemon **stderr** (e.g. `[windows] Named pipe … busy …` retry
    notice). Coding Studio treats stderr as diagnostics-only, never parsed as
    events.
12. **Can secrets appear in events or diagnostics?** Event payloads carry
    model text and tool I/O, which *can* embed secrets a user pasted; the
    approval `description` may embed command text; `set_api_key` carries the
    key itself (client→server only; never an event). Coding Studio never logs
    frame payloads beyond redacted/bounded previews (see `security-review.md`
    and `redaction` behavior in `auth.rs`); transcript content is not logged
    by this module.
13. **Can the API run without a local model or local embedding service?**
    Yes. Providers are remote; the in-process local embedding model
    (all-MiniLM-L6-v2) serves only the optional memory feature, which Coding
    Studio disables by default (`[features] memory = false`;
    `JCODE_MEMORY_EMBEDDING_BACKEND` left unset; ADR-006). No local model
    runtime and no Ollama is required, started, probed, or depended on
    (ADR-007).

## Stability assessment

Final upstream type-source verification (re-fetched at authoring time from
commit `f11adb5996c541592e28519018709eebebc9fce4`, current master head —
v0.81.7 release family):

- `crates/jcode-harness-api/src/requests.rs` — **32 named request variants**
  + `Unknown` catch-all, internally tagged `"req"` in snake_case. Coding
  Studio issues a verified minimal subset: `hello`, `list_sessions`,
  `create_session`, `attach_session`, `detach_session`, `send_message`,
  `cancel`, `permission_response`, `ping`. Field names and `skip_serializing_if`
  conventions match the encoder exactly (`send_message.content`,
  `create_session.working_dir`, `list_sessions.include_archived/limit`,
  decision strings `allow`/`allow_always`/`deny`). `set_api_key` is
  deliberately excluded — no credential transport in Milestone One.
- `crates/jcode-harness-api/src/events.rs` — **34 event tags** (+ `Unknown`
  catch-all), internally tagged `"ev"` in snake_case; **5 structured error
  codes** (`unsupported_version`, `unknown_request`, `unknown_session`,
  `invalid_request`, `internal`). Coding Studio normalizes the 30 tags it
  carries (upstream tag documented per arm in `protocol.rs`), treats
  `file_content`/`files`/`text_matches`/`file_status` as recognized-but-not-
  carried, and tolerates every other tag as diagnostic-only.
- `crates/jcode-harness-api/src/lib.rs` — `ClientFrame`/`ServerFrame`
  envelopes: every frame carries `"v":1`; replies carry `reply_to`; unknown
  fields and kinds must be tolerated by clients (our decoder complies).
- `crates/jcode-harness-api-server/src/lib.rs` acceptance test pins the
  exact hello wire line we pin in `jcode_compat.rs`
  (`{"req":"hello","min_version":1,"max_version":1,"client":…}`).
- Protocol major unchanged at `1`; churn is additive (e.g. `session_forked`,
  `peek_session`), absorbed by unknown-kind tolerance.
- Coding Studio pins `v0.81.7` and treats any other version as
  not-yet-verified (fail closed with an actionable error; ADR-002/ADR-004).

## Conclusion

The gate passes with option 1. Milestone One proceeds to implement the
compatibility foundation. Full capability inventory: `capability-matrix.md`.
