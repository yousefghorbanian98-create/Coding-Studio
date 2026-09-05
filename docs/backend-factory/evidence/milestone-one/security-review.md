# Security review — Milestone One (adversarial self-review)

Run ID: `run-2026-09-05-107b3c58` · Scope: `src-tauri/src/jcode/*`,
`src-tauri/tests/jcode_compat.rs` + fixtures, `Cargo.toml` dependency delta,
`.github/workflows/ci-windows.yml` (drafted changes), all Milestone One
evidence docs. Method: adversarial self-review against the 20 mission threat
classes; severity rubric: Critical (must fix), High (must fix), Medium (fix or
bounded follow-up), Low (record). **Zero unresolved Critical/High.**

## Threat classes

| # | Threat class | Result |
|---|--------------|--------|
| 1 | Release substitution | **Covered** — froze release triple (tag + commit + per-asset digests); probe re-fetches official `SHA256SUMS` and requires three-way agreement (record ↔ embedded constant ↔ downloaded bytes); `verify_against_pin` fails closed; substitution test included (`verification_fails_closed_on_substitution`) |
| 2 | Mutable tags | Recorded as attack class (M-1). Protection is digest-based; a re-pointed tag changes bytes ⇒ digest mismatch ⇒ fail closed before execution |
| 3 | Checksum confusion | Strict GNU `sha256sum` record parsing only (exactly two spaces, 64 lowercase hex, bare filenames); uppercase/odd-length/single-space/zero-mismatch/duplicate/traversal names rejected (5 unit tests + integration tamper test); lookup by traversal name returns `None` |
| 4 | Architecture confusion | `WindowsArch` exhaustive `{x86_64,aarch64}`, fail-closed `from_rust_arch`; legacy v0.9.x-era `sha256=...` line flagged as removed in the exact fixture (integration `official_checksum_record_parses_and_pins_match` proves only 0.81.7 records are used) |
| 5 | Command injection | Milestone One executes **no** binary at runtime. CI probe runs fixed literal argv (`./jcode.exe version --json`) on `windows-latest`; no external data reaches argv. Shell interpolation is confined to CI-pinned environment constants |
| 6 | Argument injection | Outgoing wire value is built with `serde_json` (never string-concatenation); identifier/label charset validation in `id_newtype!` and `LaunchPolicy`; redundant `validate_args` hook in `OutgoingRequest::new_send_message` |
| 7 | Env-var leakage | Launch policy env overlay is a **2-entry allowlist** (`JCODE_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`); env-set testing asserts no `*_KEY`/`*_TOKEN` variables are set; config paths never come from unvalidated arbitrary env (trait-injected, tested) |
| 8 | stdout/stderr secret leakage | Channels separated (`StreamClass::StdoutData` vs `StderrDiagnostics`); stderr is diagnostics-only, bounded, never parsed; `Display`/`Debug` of all boundary types redact via pattern hooks (`auth.rs`); secret-bearing stream test asserts replacement of `sk-`, `Bearer`, JWT, `password=` shapes |
| 9 | Malformed event DoS | Per-line strict `serde_json` decoding with closed enums + `deny_unknown_fields`; frame-level `v`/`ev` validation; bounded reads; malformed fixture → 5/5 lines fail without panic (unit + integration) |
| 10 | Oversized frame memory exhaustion | `take(MAX_FRAME_BYTES+1)` bounded `BufRead` — at most 4 MiB+1 bytes allocated per frame, ever; oversized in-code frame rejected deterministically (integration test) |
| 11 | Duplicate event replay | Detection-only, **flag-and-deliver** (changed during this review — F-4): sha256 window over raw lines, count exposed. Delivery is never silently mutated; UI idempotency remains trivial |
| 12 | Stale event/session confusion | `reply_to` outstanding-registration; `stray_reply` flag on unknown ids; mono-seq ingestion makes ordering observable; `attached` frame accepted as session-established evidence only (integration out-of-order test) |
| 13 | Approval spoofing | `take_approval_for_response` fails closed (`ApprovalNotOutstanding E1201`); single-use; cap-bounded registration; spoof-and-replay integration tests |
| 14 | Path traversal in configuration paths | Unix `.`/`..`-segment rejection; drive-root/UNC absoluteness; control-char rejection; SHA-256 fixture asset names cannot contain separators; checksum `digest_for` rejects traversal names (`../../windows-...` → `None` proven in unit test) |
| 15 | Uncontrolled network access | Boundary code performs **no networking**; the CI probe fetches the immutable artifact (integrity-verified) then runs a non-network command; telemetry disabled via explicit env; forbidden packages audited (`validate:mission` gate) |
| 16 | Process orphaning assumptions | **Not spawned in Milestone One** (deliberate); upstream issue 1jehuang/jcode#1081 (Windows orphaned processes) recorded as M2 pre-supplier; forced termination disposition modeled without claims about OS kill semantics |
| 17 | Local embedding activation | Policy default off; config override `features.memory=false` in locked launch policy; no embedding-restore env vars in overlay; tests assert the negative space |
| 18 | Accidental Ollama exposure | `PERMANENTLY_DENIED` + deny-by-default `require()` + local-runtime label hints (`ollama`, default port `11434`, `lm studio`/`lmstudio`/`lm-studio`, `llama.cpp`, `localai`, `local-model`, `on-device`); product-facing provider list structurally excludes them (unit + integration tests) |
| 19 | Provider bypass around Jcode | No provider SDK packages in the boundary; forbidden-package audit at `scripts/factory/validate-mission.mjs` covers `@anthropic-ai/sdk`, `openai`, `@google/*`, Copilot, OpenRouter; no provider HTTP code in `src-tauri` |
| 20 | Supply-chain of new dependency | Exactly **one** new dependency: `sha2 0.10` (RustCrypto, MH-9 vetted in `oss-register.md`); semver-locked; lockfile generated on CI (keeps pre-existing repo policy); no other additions |

## Findings

### Fixed during review (with code-level evidence)

- **F-1 (High, fixed during authoring)** First fixture hand-copy of Row 16 (Windows aarch64) said `unsupported/unofficial`; corrected after exact capture proved Windows aarch64 assets `+pipeline` exist — before any code consumed it. Recorded in the ADR-0002 media trail.
- **F-2 (Medium, fixed)** Initial prototype of `classify_provider_label` treated unknown labels as local-runtime-denied candidates via substring `local` — over-blocking legitimate "localhost" remote bridges. Narrowed to an explicit local-runtime hint list; no fuzzy one-word matching.
- **F-3 (Medium, fixed)** KV redactor first consumed only token-chars for values; compound secrets (`Authorization: Bearer aaa.bbb.ccc`) leaked the second half. Rewritten to consume the full field (quoted through the closing quote; unquoted through end-of-line), capped at 160 chars. Test `secret_bearing_stream_is_redacted_in_all_debug_paths` now covers the compound case.
- **F-4 (Medium, fixed)** Duplicate handling initially *suppressed* byte-identical frames — this could corrupt legitimately repeated deltas while upstream has no dedup ids to argue duplicity. Changed to **flag-and-deliver** (`Ingress::DuplicateSuspect`, counter, delivery guaranteed) — stream integrity over cosmetic dedup. Tests updated.

### Open Medium findings with bounded follow-up

- **M-1** Release integrity currently anchors on GitHub-attached `SHA256SUMS` (upstream has no Authenticode signature yet — recorded in `release-and-license.md` Row 9 as `accepted-with-documented-risk`). Follow-up (bounded): at the next pin bump, re-check whether upstream signs Windows binaries; if yes, add signature verification to the probe. Deadline: re-evaluated at every pin bump.
- **M-2** Pattern-based redaction is heuristic (SK-, xoxb-, ghp_, JWT, KV shapes). Justified: all boundary streams are short and pattern-covered; raw payload logging is absent by design, so the leak surface is Display/Debug strings only. Follow-up (bounded): when Milestone Two ships the supervisor, restrict diagnostics export to the redaction layer and audit for free-form string logging.
- **M-3** Adjacency-window duplicate detection is suspicious-flagging only (no suppression) and may under-detect far-apart replays (window = 64). Justified: local trust boundary makes replay injection unlikely; under-detection is safe (delivery unchanged). Follow-up (bounded): promote to suppression only if an upstream *reply dedup* mechanism is proven.

### Low (recorded, no action)

- **L-1** `FrameDecoder` with a hostile reader could spin on `Ok(Some)` per byte — bounded by `take()`; acceptable at this surface.
- **L-2** CI probe downloads ~130 MB per run. Justified by immutability-over-caching; re-verify every run.
- **L-3** `jcode --help` behavior unverified (listed in `windows-evidence.md` deferred probes).

## Verdict

**Zero Critical, zero High unresolved.** Three Medium findings fixed in-place
(F-2/F-3/F-4), three Medium carried with bounded follow-up (M-1/M-2/M-3).
The boundary is cleared for Milestone Two design *without* any change to the
capability matrix support states this review produced.
