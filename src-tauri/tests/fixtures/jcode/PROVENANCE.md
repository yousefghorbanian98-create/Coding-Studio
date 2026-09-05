# Fixture Provenance — Jcode compatibility (Milestone One)

Upstream reference: `https://github.com/1jehuang/jcode`, tag `v0.81.7`,
commit `358226c2a35b8b50d4d520b3363b0dc60c000fdb`; harness API source of
truth `crates/jcode-harness-api/` (+ `jcode-harness-api-server`).

Fixture classes: **exact** = byte-identical official content; **derived** =
written from the upstream type definitions/schema-snapshot tests read at the
pinned commit; **synthetic** = constructed by Coding Studio to model an edge
upstream documents but we could not capture (no live runtime in this
environment). No fixture is mislabeled: nothing below is claimed as captured
upstream output except the exact class.

## release/

| file | class | provenance |
|---|---|---|
| `sha256sums-v0.81.7.txt` | **exact** | Fetched from the tag-immutable URL `https://github.com/1jehuang/jcode/releases/download/v0.81.7/SHA256SUMS` on 2026-09-05. Independently proven byte-exact: 836 bytes, SHA-256 `733aebe30981a81c5d8205ac76b6d57399e4fbd4dc77ec1b371478dfe68cce0e`, equal to the GitHub API `digest` of release asset id 544965885. Sanitization: none needed (contains only digests and public asset names). Representative because it IS the official checksum record, not a sample of it. |

## version/

| file | class | provenance |
|---|---|---|
| `v0.81.7.json` | derived | Field-for-field shape of `VersionReport` in `src/cli/commands/report_info.rs:415` at the pin, filled with the release's facts (`semver 0.81.7`, `git_tag v0.81.7`, `release_build true`). Not a capture: the sandbox cannot run the Windows binary. Representative because the nine keys exhaust the upstream struct. |
| `unsupported-older-v0.80.1.json` | derived | Same shape; version of the real prior release `v0.80.1` (observed in the release list) with placeholder `git_hash`. Representative of "older than pin → fail closed". |
| `unknown-newer.json` | synthetic | `0.82.0` — a plausible-but-unverified future version. Representative of "newer is unknown, never assumed compatible" (ADR-0002/0004). |
| `malformed-missing-semver.json` | synthetic | `"semver": "not-a-semver"`, empty `version`. Representative of unparseable/contradictory reports. |

## protocol/

All `derived`-class files reconstruct frames exactly as
`crates/jcode-harness-api/src/lib.rs` (`ServerFrame { v, reply_to, event }`)
plus `events.rs` field-for-field at the pin define them; cross-checked against
upstream's own snapshot test strings (`harness_api_tests/schema_snapshot.rs`,
e.g. the literal `{"v":1,"reply_to":3,"ev":"hello_ok",...}` assertion).

| file | class | notes |
|---|---|---|
| `handshake-hello-ok.ndjson` | derived | `hello_ok` with the bridge's real advertised capability list (from `jcode-harness-api-server/src/lib.rs` handshake block). |
| `session-stream.ndjson` | derived | Full successful turn: hello_ok, attached, status generating, message_accepted, connection_phase, model_info, reasoning_delta/done, two text_deltas, token_usage, status idle, turn_done. Session id `sess-2026-09-05-a01` (fixture-only). |
| `tool-call.ndjson` | derived | tool_start → tool_input_delta → tool_exec → tool_done for one `read` call. |
| `approval-turn.ndjson` | derived | tool_start → permission_request (`perm-77ab`) → tool_done → turn_done; the resolution is a *client* frame, produced by the encoder in the integration test. |
| `structured-errors.ndjson` | derived | All five upstream `ErrorCode` variants as `error` events with plausible messages (message texts: one verbatim from upstream source, the rest paraphrased). |
| `unknown-event.ndjson` | derived | Unknown additive kind followed by a normal frame: proves tolerance. |
| `duplicate-event.ndjson` | derived | Byte-identical adjacent `text_delta`: the only duplicate shape detectable without upstream ids. |
| `out-of-order-reply.ndjson` | derived | `reply_to: 42` with no such request (stray), a normal `pong`, then a byte-identical replay: exercises stray-flag + window suppression. |
| `missing-required-field.ndjson` | derived | Four frames each missing exactly one required key (`v`, `ev`, `session_id`, `request_id`). |
| `malformed.ndjson` | synthetic | Truncated JSON line, non-JSON text, a JSON array, a bare string, broken syntax. |
| `truncated-stream.ndjson` | derived | Four valid frames then EOF mid-turn (no `turn_done`): stream-level truncation, distinct from malformed lines. |
| `diagnostics-stderr.txt` | derived | Bridge stderr notices; the first line echoes the real `[windows] Named pipe … busy … retrying` message from `jcode-transport/src/windows.rs` with a fixture pipe hash. |
| `secret-bearing-stream.ndjson` | synthetic | Text/tool frames embedding *fake* secret shapes (`sk-…`, `Bearer aaa.bbb.ccc`, JWT-shaped `eyJ…`). Used to prove Display/Debug redaction. No real credential material exists anywhere in this repository. |
| `tui-scrape-attempt.bin` | synthetic | ANSI/VT100 + box-drawing bytes resembling a TUI frame (clear-screen `ESC[2J`, colors, cursor addressing). Proves the decoder rejects terminal output structurally (ADR-0005). |
| oversized frame | in-test | A >4 MiB single-line `text_delta` is constructed inside the integration test (3 MB would sit on disk as fixture bloat; code generation is the bounded fix). Documented here per the fixture rules. |
| cancellation/approval client frames | in-test | Outbound encodings (`cancel`, `permission_response`, `hello`) are asserted as exact wire strings in tests; the wire shape is derived from `requests.rs` at the pin. |

## exit/

| file | class | notes |
|---|---|---|
| `normal-exit.json` | synthetic | `{exit_code: 0}` record — exit codes are not formally documented upstream (capability row 17 partial/unknown); used for `classify_exit` coverage. |
| `abnormal-exit.json` | synthetic | `{exit_code: 1}` record, mirroring the observed `std::process::exit(1)` error path pattern (`src/cli/commands.rs:1992`). |
