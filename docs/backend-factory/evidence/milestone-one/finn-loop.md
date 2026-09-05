# Milestone One — Finn Loop Passes

Separate logical passes over the milestone. The builder may not approve its
own output; the review passes are recorded in `security-review.md`,
`windows-evidence.md`, and `independent-review.md` (fresh-pass review over the
actual diff, not the builder summary).

## Pass 1 — Specifier

Output: scope wall for `m1-jcode-compat` derived from the frozen mission.

In scope: upstream verification, protocol gate, CS-owned compatibility module
(`src-tauri/src/jcode/`: version policy, release/checksum metadata, NDJSON
protocol normalization with bounded+redacted handling, lifecycle/auth/config
capability models, stable error codes), fixtures with provenance, unit +
integration tests, Windows CI probe (integrity-verified, non-authenticated),
evidence docs, ADRs, state/journal updates, Draft PR.

Explicitly out (frozen boundaries): full supervisor (M2), Tauri IPC wiring
(M3), event/session lifecycle enforcement (M4), provider onboarding UI (M5),
Ruflo/Soup/OmniRoute, Hermes/AgentMemory/BrowserUse/Scientific-Skills as
dependencies, provider SDKs, Ollama anything, TUI scraping, provider auth UI,
real credentials/paid APIs, releases/purchases.

## Pass 2 — Upstream Researcher

Output: `upstream-provenance.md`, `release-and-license.md`,
`capability-matrix.md`. Key facts: official repo `1jehuang/jcode@master`
verified at `f11adb59`; selected `v0.81.7` (annotated tag → commit
`358226c2`, ancestor of master; latest *published* release 2026-09-04); MIT;
Windows x86_64/aarch64 assets + GNU-format `SHA256SUMS` recovered byte-exact
and proved against the GitHub API digest; old `v0.9.x` line (April 2026)
documented as not-newer; harness API v1 chosen; known Windows issues
(#977/#498/#1081) routed to M2/M4.

## Pass 3 — Protocol Designer

Output: `protocol-selection.md` (gate PASS, option 1) + the CS-owned contract
shape: strict NDJSON frame decode with control-byte rejection (no terminal
semantics possible), `v`-major deny-by-default negotiation, typed newtype
identifiers, unknown-kind preservation in bounded redacted form only,
ingest-assigned monotonic `seq` plus duplicate-adjacent detection,
stdout=data/stderr=diagnostics separation, stable CS error codes.

## Pass 4 — Rust Builder

Output: `src-tauri/src/jcode/` module set + `src-tauri/tests/jcode_compat.rs`
+ fixtures under `src-tauri/tests/fixtures/jcode/` with `PROVENANCE.md`.
Constraint adherence: only new crate `sha2` (OSS register §6); no upstream
structs cross the boundary; deny-by-default capabilities; redaction-safe
Debug/Display; no process spawn, no network, no credential storage, no Ollama
surface. Builder does not mark the milestone complete.

## Pass 5 — Security Reviewer

Output: `security-review.md` — adversarial review over the 20 listed threat
classes with findings by severity and resolutions. Zero Critical/High open;
Mediums either fixed or justified with a bounded follow-up.

## Pass 6 — Windows Reviewer

Output: `windows-evidence.md` — architecture mapping, path/pipe resolution
tests, CI probe design and results, artifact integrity.

## Pass 7 — Independent Final Reviewer

Output: `independent-review.md` — fresh completeness/provenance/architecture/
protocol/security/test/Windows/resource/scope review over the real diff,
including defect→reproduce→regression-test→fix→re-review loops within the
bounded self-healing limits.
