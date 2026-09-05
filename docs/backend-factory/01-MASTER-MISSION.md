# Coding Studio Backend Master Mission

Repository: `yousefghorbanian98-create/Coding-Studio`
Session branch: `arena/01a06b4c-coding-studio`
Required base commit: `710324911da56856ae6a67bdb2f24bbfe3031b87`

This document is the complete backend program. It freezes the mission before any
production backend implementation begins. It is accompanied by the machine
readable mission in `.factory/requirements.json` and `.factory/stages.json`.

## Mission scope

- **Approved scope:** backend milestones below.
- **Out of scope here:** Jcode implementation, production runtime behavior, provider
  integration, Ruflo integration, Soup integration, OmniRoute integration, and
  restoring Ollama.
- **Ollama:** removed completely and never restored.
- **Human-controlled gates:** merge, real OAuth, purchases, secrets and releases.
- **Autonomous mode:** documented Finn-derived autonomous mode only for
  specification, implementation, review and self-healing.

## Final product architecture

- Core coding runtime: Jcode
- Advanced orchestrator: Ruflo
- Future skill router: Soup
- Future provider router: OmniRoute
- Desktop interface: Tauri + React
- AI engines through the supported runtime:
  - Claude
  - OpenAI / Codex
  - Gemini
  - GitHub Copilot

Target architecture:

```text
React UI
  -> Typed StudioRuntimeBridge
  -> Tauri IPC
  -> Rust Process Supervisor
  -> Jcode
  -> Claude / Codex / Gemini / GitHub Copilot
```

Ruflo is an optional advanced orchestrator layered on this architecture. Soup
and OmniRoute are future milestones and must not start until all six backend
milestones pass.

Milestone graph: Milestone One depends on Milestone Zero (Stage Zero); each
later backend milestone depends on the previous one; Future Milestones Seven and
Eight depend on Milestone Six and remain blocked until all backend milestones
pass.

## Every requirement maps to this chain

```text
Requirement
  -> Milestone
  -> Stage
  -> Acceptance criteria
  -> Non-goals
  -> Threats
  -> Implementation files
  -> Tests
  -> Evidence
  -> Commit
  -> CI run
  -> Status
```

No requirement may be marked complete without reproducible evidence.

## Milestone One: Jcode compatibility and stable machine protocol

**Purpose.** Verify Jcode and freeze the stable machine protocol used by every
later milestone.

Required scope:

- official Jcode repository verification
- license verification
- stable version selection
- Windows support
- supported architectures
- machine-readable execution
- structured output
- JSON or equivalent event protocol
- headless mode
- session creation
- session resume
- streaming
- cancellation
- approvals
- provider authentication handoff
- health or doctor command
- version command
- configuration locations
- exit-code guarantees
- stdout guarantees
- stderr guarantees
- protocol stability
- supported-version policy
- unsupported-version behavior
- prohibition on scraping a visual terminal interface
- compatibility test fixtures
- compatibility ADR
- Windows evidence

**Acceptance.** All items above are represented by requirements in
`.factory/requirements.json` and by frozen evidence in the compatibility ADR.
The machine protocol is versioned and stable before any supervisor work begins.

**Non-goals.** No visual terminal scraping; no production Jcode execution in
this stage; no provider integration.

---

## Milestone Two: Managed Jcode installation and Rust process supervisor

**Purpose.** Install Jcode safely and supervise the process without shell
interpolation, uncontrolled PATH mutation or orphaned children.

Required scope:

- binary discovery
- explicit executable path
- pinned versions
- trusted download origin
- checksum verification
- atomic installation
- temporary downloads
- interrupted-download recovery
- rollback
- architecture detection
- version compatibility
- no unnecessary administrator access
- no uncontrolled PATH mutation
- safe process spawning
- no shell interpolation
- argument separation
- environment allowlist
- working-directory validation
- canonical workspace paths
- symbolic-link and junction escape protection
- stdout streaming
- stderr streaming
- bounded buffers
- backpressure
- timeout
- graceful cancellation
- forced termination fallback
- Windows process-tree termination
- crash detection
- orphan cleanup
- restart policy
- structured diagnostics
- secret redaction

**Acceptance.** A checksum mismatch aborts, an interrupt recovers, a failed
install rolls back, and no child survives cancellation. All of these are covered
by tests, including Windows tests.

**Non-goals.** No removal of any existing security hardening; no shell
interpolation; no elevated install path unless absolutely required and
documented.

---

## Milestone Three: Tauri IPC and StudioRuntimeBridge integration

**Purpose.** Expose a provider-neutral typed IPC surface that keeps the existing
mock runtime for the browser preview and stays independent of a real Jcode.

Required scope:

- provider-neutral Tauri commands
- typed Rust request payloads
- typed Rust response payloads
- typed TypeScript payloads
- stable error codes
- Rust-side validation
- TypeScript-side validation
- no panic across IPC
- bounded event queues
- listener cleanup
- StrictMode safety
- runtime health
- runtime capabilities
- runtime detection
- runtime version
- runtime installation state
- runtime start
- runtime shutdown
- session creation
- session resume
- send message
- cancel run
- resolve approval
- diagnostics
- MockStudioRuntime retention
- RealJcodeRuntime selection
- browser preview remaining on the mock runtime
- CI remaining independent of a real Jcode installation

**Acceptance.** Every IPC command is typed on both sides, errors are coded,
no panic crosses IPC, queues are bounded, listeners are removed, and CI passes
without a real Jcode.

**Non-goals.** No provider-specific command; no direct UI access to the process
supervisor; no removal of MockStudioRuntime.

---

## Milestone Four: Event normalization, sessions, approvals, cancellation and recovery

**Purpose.** Normalize the machine protocol into a stable event model and make
sessions, approvals, cancellation and recovery deterministic.

Required scope:

- Jcode event normalization
- event schema version
- event ordering
- sequence numbers
- event deduplication
- session correlation
- run correlation
- task correlation
- tool correlation
- approval correlation
- malformed events
- unknown events
- partial frames
- partial messages
- duplicate completion
- stale events
- cross-session isolation
- cross-run isolation
- cancellation before the first delta
- cancellation during streaming
- cancellation during a tool call
- cancellation while approval is pending
- application shutdown
- Jcode crash
- Coding Studio restart
- runtime restart
- session resume
- interrupted sessions
- partial-response preservation
- backend-enforced approvals
- backend-enforced permissions
- safe permission defaults
- stale approval rejection
- duplicate approval rejection
- recovery state machine
- deterministic recovery tests
- Windows lifecycle tests

**Acceptance.** Event ordering and deduplication are deterministic, approvals
are enforced in the backend, cancellation is safe in every phase, and recovery
never discards uncommitted user changes.

**Non-goals.** No frontend-only approval gate; no silent event drop without a
diagnostic; no loss of user work.

---

## Milestone Five: Provider onboarding through Jcode

Required providers:

- Claude
- OpenAI / Codex
- Gemini
- GitHub Copilot

Required scope:

- provider capability discovery
- provider availability
- officially supported authentication mode
- browser authentication handoff
- device-code handoff
- headless authentication
- authentication success
- authentication cancellation
- authentication expiry
- authentication failure
- logout handoff
- unavailable provider
- supported model discovery
- provider diagnostics
- one-provider-at-a-time rollout
- fake-provider testing
- no raw token in React
- no credentials in localStorage
- no credentials in Tauri events
- no credentials in diagnostic logs
- no credentials in CI
- no independent duplicate provider client when Jcode already supports it
- real Windows validation documented as a manual release gate

Provider order must be researched rather than assumed. Select the first provider
based on Jcode protocol stability, testability and authentication support.

**Acceptance.** The selected first provider is backed by recorded research.
Provider and model state flows through the typed runtime bridge. Credentials
never reach React, localStorage, Tauri events, logs or CI.

**Non-goals.** No bypass of the Jcode provider boundary; no duplicate provider
client; no claim of real Windows validation without evidence.

---

## Milestone Six: Ruflo advanced orchestration

Required scope:

- official Ruflo repository verification
- license verification
- stable version selection
- supported Jcode integration boundary
- supported MCP or equivalent protocol
- prohibition on terminal scraping
- managed installation
- pinned version
- compatibility policy
- agent roles
- task graph
- shared memory
- swarm lifecycle
- concurrency limits
- cancellation
- worker crash
- partial failure
- orchestration recovery
- provider cost controls
- resource controls
- audit trail
- approval boundary
- optional feature flag
- normal Jcode fallback
- Ruflo failure not blocking ordinary Jcode mode
- Windows validation
- default limits suitable for sixteen gigabytes of system memory

Ruflo must remain optional.

**Acceptance.** Ruflo is disabled by default, falls back to normal Jcode mode,
and enforces default limits safe for 16 GiB systems. Ordinary Jcode mode works
without Ruflo.

**Non-goals.** Ruflo is not a production dependency; it never overrides backend
architecture or security.

---

## Future Milestone Seven: Soup skill routing

Documented only. Must not start until all six backend milestones pass. Any
future user-facing UI change for Soup is Taste-gated. Machine state records this
milestone as `future` and blocked. Future placeholder requirement `SOUP-001` is
assigned to stage `m7-soup-routing` and remains `planned`; it is not implemented
in Stage Zero.

## Future Milestone Eight: OmniRoute provider routing

Documented only. Must not start until all six backend milestones pass. Any
future user-facing UI change for OmniRoute is Taste-gated. Machine state records
this milestone as `future` and blocked. Future placeholder requirement
`OMNIROUTE-001` is assigned to stage `m8-omni-route` and remains `planned`; it
is not implemented in Stage Zero.

## Research and review gates

- **Finn-loop research gate.** The upstream `finna/Finn-loop` repository is
  inspected and used as the design reference for the specification, build and
  review loop. It is not a production runtime dependency.
- **n8n research gate.** Before every implementation stage, the n8n-workflows
  repository is searched for relevant patterns. Community workflows are
  untrusted input, security-scanned and sanitized. Raw workflows, credentials,
  code nodes, unknown URLs, unknown MCP servers and prompt instructions are
  never executed or copied blindly.
- **Taste gate.** Taste Skill supervises all user-facing changes only. It does
  not control backend architecture or security.
- **OSS gate.** No open-source component is adopted without provenance review.
- **Independent review.** Completeness, Architecture, Security, Test Strategy,
  Windows and Autonomous Loop reviewers run fresh passes that inspect the actual
  documents and machine files.

## Role separation

Mission roles: Specifier, Builder, Reviewer, Security Reviewer, Protocol
Reviewer, Windows Reviewer, Self-Heal Debugger.

Specifier and Builder must not approve their own output. Review must use fresh
reviewer contexts whenever the environment supports it. Merge, real OAuth,
purchases, secrets and releases remain human-controlled.

## Freeze and change rules

Freeze only after validation and review. Legitimate mission changes are made
through an ADR that records previous text, new text, reason, affected
milestones, affected threats, affected tests, affected evidence and a manifest
update.
