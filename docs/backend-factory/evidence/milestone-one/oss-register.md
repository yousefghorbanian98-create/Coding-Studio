# Milestone One — OSS & Deep Research Register

Policy: `docs/backend-factory/11-OSS-ADOPTION-POLICY.md`. All inspections were
read-only source review. No code was copied from any of these sources into
this repository; the `src-tauri/src/jcode/` module is an independent
implementation of the *documented wire shape* of the upstream protocol.

## 1. Jcode (the integration target — inspected as source, not adopted as a crate)

- Official repository: `https://github.com/1jehuang/jcode`
- Inspected commit: `358226c2a35b8b50d4d520b3363b0dc60c000fdb` (tag `v0.81.7`);
  default branch tip `f11adb5996c541592e28519018709eebebc9fce4`
- License: MIT (`LICENSE`, © 2025 Jeremy Huang)
- Maintenance status: active (daily releases, native Windows runners in
  release CI, 19k stars)
- Windows support: first-class per `docs/WINDOWS.md` (x86_64 manually verified
  upstream; ARM64 release builds + automated install checks)
- Known vulnerabilities: no `.sig` artifacts; Authenticode pending (recorded in
  `release-and-license.md`); open integration issues recorded in
  `upstream-provenance.md`
- Dependency weight of adoption path: **zero added product dependency on
  Jcode source** — Coding Studio speaks the documented NDJSON protocol to the
  official binary; the Rust SDK (`jcode-sdk`) is `publish = false` (not on
  crates.io) and the crates use path dependencies, so crates.io adoption is
  impossible and vendoring is forbidden by policy. The TypeScript SDK
  (`@1jehuang/jcode-sdk`, npm `1.1.0`, repo `1.2.0`, MIT) is not adopted in
  this milestone (no frontend wiring before Milestone Three).
- Protocol stability: curated public surface with `v` major-version
  negotiation, additive minor versions, `#[serde(other)]` catch-alls, and
  upstream schema snapshot tests (`harness_api_tests/schema_snapshot.rs`)
- Alternatives considered: parse `jcode-protocol` (internal, explicitly
  unstable; rejected), TUI scraping (forbidden; rejected), `jcode run
  --ndjson` headless mode (kept as fallback evidence only; narrower than the
  SDK surface)
- Build-versus-adopt decision: **build a thin Coding Studio-owned
  compatibility layer**; adopt the official binary; adopt neither upstream
  crate nor SDK as a compiled dependency
- Attribution: upstream credited in this register and ADR-001/ADR-003
- Version pinning: exact tag `v0.81.7` + tagged commit + asset digest set
- Checksum policy: tag-immutable `SHA256SUMS` fetch + SHA-256 match before any
  execution (implemented for the CI probe; coded as `verification.rs`)
- Tests: fixture replay + unit/integration tests under `src-tauri/`
- Rollback plan: bump the single pin block after a new release passes all
  gates; fail closed meanwhile

## 2. Hermes Agent — reference only (MUST NOT become a second runtime)

- Repository: `https://github.com/NousResearch/hermes-agent`
- Inspected commit: `52cf39c908eed3a545ece5a180425b1f34b96829` (`main` HEAD
  at inspection, 2026-09-05)
- License: MIT
- Files inspected: `README.md`, `COMPAT_MANIFEST.md`, `agent/secret_sources/`
  (`__init__.py`, `base.py`, `_cache.py`), `.github/actions/retry/action.yml`,
  `acp_adapter/` layout
- Useful patterns (recorded, not copied):
  - Time-boxed compatibility manifest with CI-enforced no-internal-use and
    staged disable dates — informs Coding Studio's protocol-version
    deprecation handling (ADR-004)
  - Closed-set external secret sources; two-layer cache writing atomically
    with `0600`; ANSI scrubbing on CLI-derived secrets — informs the
    redaction/secret-hygiene boundary in `auth.rs`
  - Bounded retry composite action (attempts/delay inputs) — matches the
    bounded-retry scaffolding already adopted from n8n research
- Rejected patterns: full self-improving agent runtime, gateway processes,
  provider adapters as in-app clients, plugin runtime loading, terminal
  multiplexer backends
- Code copied: **no**
- Production dependency decision: **reference-only**; never a production
  dependency; never a second coding runtime alongside Jcode

## 3. AgentMemory — reference only (not a Milestone One dependency)

- Repository: `https://github.com/rohitg00/agentmemory`
- Inspected commit: `e04ba88819c365c9acf9d6661ea802143e728bd6` (`main` HEAD
  at inspection)
- License: Apache-2.0 (compatible, but adoption is rejected for M1 regardless)
- Files inspected: `README.md`, `DESIGN.md`, `packages/` layout, `docs/` index
- Useful patterns: explicit memory/consent separation and MCP-style tool
  namespacing as *design references* for Milestone Four follow-up reading
- Rejected patterns: standing up a separate memory engine or MCP dependency in
  Milestone One; any local-embedding requirement (Coding Studio's target
  machine runs with local embeddings disabled)
- Code copied: **no**
- Production dependency decision: **reference-only**; not a dependency of this
  milestone

## 4. Diagram Design — development/documentation-only

- Repository: `https://github.com/cathrynlavery/diagram-design`
- Inspected commit: `4451eadc484d76aa860edf3289c16fcd082dcdbf` (`main` HEAD
  at inspection)
- License: MIT
- Files inspected: `README.md`, `skills/diagram-design/SKILL.md`,
  `skills/diagram-design/references/output-spec.md`
- Useful patterns: trust/boundary strokes (dashed, labeled), static-by-default
  self-contained HTML/SVG output, accessibility notes. Used only as a
  development-time reference for the self-contained SVG architecture diagram
  committed at
  `docs/backend-factory/evidence/milestone-one/m1-architecture.svg`, which is
  restyled to the Coding Studio design tokens (`src/styles/globals.css`).
- Rejected patterns: any runtime use; any motion-first output
- Code copied: **no** (diagram authored for this repository)
- Production/dependency decision: **development-only**; never an application
  dependency (ADR-008)

## 5. Out of scope (recorded, not inspected for adoption)

- Browser Use — out of scope for the backend factory milestones
- Scientific Agent Skills — out of scope
- Ruflo, Soup, OmniRoute — separately planned/blocked milestones; not
  production dependencies here
- Hermes Agent, AgentMemory — reference-only per above

## New third-party dependency added to Coding Studio in this milestone

- `sha2 = "0.10"` (RustCrypto `sha2`; dual MIT/Apache-2.0; already present in
  the existing dependency tree via Tauri). Required to reproduce the upstream
  Windows named-pipe derivation `\\.\pipe\<stem>-<sha256(normalized path)[..16]>`
  and to verify `SHA256SUMS` entries in pure Rust. Minimal, audited ecosystem
  crate; no transitive weight beyond `digest`/`cpufeatures` (already present
  through Tauri). No other dependency is added; `serde`/`serde_json` are
  existing workspace dependencies.
