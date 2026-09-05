# Milestone One — Jcode Capability Matrix

Canonical target: `1jehuang/jcode` tag `v0.81.7`
(commit `358226c2a35b8b50d4d520b3363b0dc60c000fdb`), harness API protocol
major `v = 1` (minor `0`). "Unknown" means absence of evidence, **not**
support. Machine-readable form: the `CAPABILITIES` table in
`src-tauri/src/jcode/lifecycle.rs`; the two are reviewed together.

Statuses: `supported` / `partial` / `unsupported` / `unknown`.
Automated test column: fixture/coverage in this repository (Rust tests).
Windows column: how Windows behavior is evidenced.

| # | Capability | Status | Exact evidence (upstream, @ v0.81.7) | Automated test | Windows evidence | Coding Studio decision |
|---|---|---|---|---|---|---|
| 1 | Version output | supported | `jcode version --json` → `VersionReport` keys: `version, semver, base_semver, update_semver, git_hash, git_tag, build_time, git_date, release_build` (`src/cli/commands/report_info.rs:415`) | `version.rs` unit tests + fixtures `version-*.json` | CI probe `jcode-release-probe` runs it on `windows-latest` | pin-compare + classify; fail closed |
| 2 | Health / doctor command | supported | `jcode auth status --json`; `jcode auth doctor [--validate] --json` (`src/cli/args.rs` `AuthCommand`); `jcode provider-doctor <p> --tier offline` — no key, no spend (`docs/PROVIDER_DOCTOR.md`) | fixture parse of `--json` shapes deferred; contract covered via error-path tests | probe scope limited to `version` (offline, zero auth) | diagnostics surface only; never a gate signal beyond version |
| 3 | Headless execution | supported | `jcode run [--json|--ndjson] "<message>"` (`src/cli/args.rs` `Command::Run`) | not exercised by M1 (needs live runtime) | n/a (M2 supervisor gate) | not the integration surface; evidence only |
| 4 | Structured event output | supported | harness `ApiEvent` NDJSON (`crates/jcode-harness-api/src/events.rs`); headless NDJSON vocabulary (`src/cli/commands.rs:3133`) | fixture replay of all normalized events | via unit+integration tests (portable) | primary surface |
| 5 | Server/client mode | supported | `jcode serve` daemon + `jcode api-bridge` (`src/cli/args.rs:557`), SDK `ensure_runtime` (`crates/jcode-sdk/src/launch.rs:505`) | pipe-name/transport tests are pure functions | named-pipe derivation tested for Windows paths | use via official binary only (M2 launches) |
| 6 | Rust SDK | supported (in-repo) | `crates/jcode-sdk` v0.1.0, `publish = false`; not on crates.io | n/a (not adopted) | SDK Windows transport commits `fd778e07`, `cd9d3661` | not adopted; CS-owned boundary instead |
| 7 | TypeScript SDK | supported (published) | `sdk/typescript` (`@1jehuang/jcode-sdk`; npm `1.1.0`; repo `1.2.0`; MIT) | n/a (not adopted in M1) | npm win32-x64/win32-arm64 dirs exist in `sdk/npm` | deferred to Milestone Three decision |
| 8 | Session creation | supported | `ApiRequest::CreateSession` → `Attached { session }` | `session_created` fixture | portable tests | supported |
| 9 | Session resume | supported | `AttachSession` + `ListSessions` (persisted; `docs/RESUME_BEHAVIOR.md` — interactive `/resume` is UI-local) | `attach` semantics in fixture stream | portable tests | supported; TUI picker not replicated |
| 10 | Streaming response | supported | `text_delta`, `reasoning_delta`, `reasoning_done` | `text_stream` fixture | portable tests | supported |
| 11 | Tool-call events | supported | `tool_start`, `tool_input_delta`, `tool_exec`, `tool_done` | `tool_call` fixture | portable tests | supported |
| 12 | Approval-request events | supported | `permission_request { session_id, request_id, tool_name, description }` | `approval_requested` fixture | portable tests | supported; description treated as untrusted preview |
| 13 | Approval-response input | supported | `permission_response { session_id, request_id, decision: allow/allow_always/deny }` | request-encode tests | portable tests | supported; resolves only outstanding ids (M4 enforcement) |
| 14 | Cancellation | partial | request `cancel { session_id }` exists; **no** dedicated `cancelled` event in harness v1; headless surface emits `{"type":"interrupted"}` | request-encode test + matrix assertion of the gap | n/a | request-side supported; confirmation event honestly `unknown`; do not synthesize one |
| 15 | Graceful shutdown | partial | `jcode server stop` subcommand exists; no protocol-level shutdown frame in v1 | matrix only | M2 gate | model as `unknown` at protocol level |
| 16 | Forced termination expectations | unknown→risk | no protocol concept; upstream issue `#1081` (Windows bg cancel leaves descendants) | matrix only | M2 supervisor gate | library models `Expectation::RequiresSupervisor` |
| 17 | Exit codes | partial | error paths use non-zero exit (e.g. `std::process::exit(1)` in `src/cli/commands.rs:1992`); no documented table | `exit_class` fixture (synthetic model) | probe asserts `version --json` exits 0 | treat nonzero as failure with captured stderr diagnostics |
| 18 | stdout contract | supported | protocol frames on socket; `run --ndjson`/`version --json` → stdout JSON only | decoder accepts only JSON frames | probe captures stdout/stderr separately | stdout = data channel |
| 19 | stderr contract | supported (policy) | bridge writes operator notices to stderr (`[windows] Named pipe …`) | `classify_stream_bytes` tests (ANSI/control-byte rejection) | probe asserts stderr is captured, not parsed | stderr = diagnostics only, never events |
| 20 | Configuration discovery | supported | `%USERPROFILE%\.jcode` / `JCODE_HOME` override; `config.toml`; runtime dir `%TEMP%\jcode-<user>` with `JCODE_RUNTIME_DIR`; socket overrides `JCODE_API_SOCKET`, `JCODE_SOCKET` | `config.rs` Windows path tests | table-driven Windows assertions (no host dependence) | mirror upstream resolution; validate + traversal-guard |
| 21 | Provider discovery | supported | `RuntimeInfo`/`ModelInfo`/`ListModels`; `jcode provider …` family | `model_info` in fixtures | portable tests | discovery only; no direct provider clients (boundary) |
| 22 | Authentication handoff | supported | `jcode login` (OAuth/API key), harness `set_api_key` (owner-only store, OAuth excluded), `jcode auth status/doctor` | `auth.rs` state tests (no credential storage) | `credential_updated` event model only | auth is **Jcode-managed** by handoff; Coding Studio never stores credentials |
| 23 | Error events | supported | `error { code: unsupported_version/unknown_request/unknown_session/invalid_request/internal, message }` | `structured_error` fixture (all 5 codes) | portable tests | mapped to stable CS error codes; message redacted |
| 24 | Protocol/schema version | supported | `API_VERSION_MAJOR = 1`, `MINOR = 0`; hello min/max negotiation; `unsupported_version` fail path | `hello` fixtures: v1 accepted; v0/v2 rejected | portable tests | deny-by-default major; minor tolerated additive |
| 25 | Event sequence identifiers | unsupported upstream | `ServerFrame` has `v`, `reply_to`, event only — no global seq | sequencer tests | portable tests | CS assigns monotonic `seq` at ingest |
| 26 | Request/run/session correlation ids | supported | `id`/`reply_to`, `session_id`, `call_id`, permission `request_id` | fixtures assert presence + typing | portable tests | newtype-validated identifiers |
| 27 | Duplicate-event behavior | unknown upstream | no dedup ids in protocol | exact-duplicate adjacent frame flagged in tests | portable tests | diagnostics-only detection; stream never silently mutated |
| 28 | Malformed-frame behavior | supported (fail-closed) | bridge: malformed first frame → `invalid_request` error then close; oversized → close ("stream is mid-frame, no way to resynchronise") | malformed/oversized/truncated fixtures | portable tests | decoder fails closed with actionable CS error |
| 29 | Maximum frame/message limits | supported | bridge `MAX_FRAME_BYTES = 16 MiB` (`harness-api-server/src/lib.rs:42`) | `MAX_FRAME_BYTES = 4 MiB` bound tests | portable tests | CS bound 4 MiB (deliberately tighter; actionable error) |
| 30 | Windows x86_64 | supported | native `x86_64-pc-windows-msvc` build on `windows-latest`; `docs/WINDOWS.md` "Supported and manually verified" | target/arch mapping tests | CI probe on `windows-latest` executes `version --json` | first required architecture |
| 31 | Windows ARM64 | supported (release tier) | `aarch64-pc-windows-msvc` build on `windows-11-arm` + automated install checks (`verify_windows_install.ps1`) | mapping tests | asset+pipeline evidence; live probe is a later explicit gate (bounded follow-up, see security-review) | evidence tier per target machine |
| 32 | Behavior with local embeddings disabled | supported-by-config | memory feature flag (`[features] memory = false`; `Features.memory` default true); embedding backend `local` is in-process ONNX (all-MiniLM-L6-v2, no network); `JCODE_MEMORY_EMBEDDING_BACKEND` | `lifecycle.rs` launch-policy tests assert embeddings disabled + memory denied by default | policy-only this milestone | disabled by default (ADR-006) |
| 33 | Local model runtime / Ollama | **excluded by contract** | upstream Ollama mentions confined to OpenRouter provider context (`jcode-provider-openrouter-runtime/src/ollama_context.rs`) — a *remote provider catalog* concern | tests assert no ollama/local-model capability can enter the CS capability set (incl. parsing a `model_info` naming "ollama" → `denied` class, never product-facing) | n/a | denied + absent (ADR-007) |

## Summary counts (machine-checkable)

- supported: 21 · partial: 3 · unsupported (upstream): 1 (sequence ids) ·
  unknown: recorded only where stated, never promoted to supported
- denied-by-contract: local model runtime, Ollama, TUI scraping
- Every `supported` row names an exact upstream file/command; every row names
  its automated-test and Windows-evidence status.
