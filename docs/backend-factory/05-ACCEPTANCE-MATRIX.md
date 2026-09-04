# Acceptance Criteria Matrix

Generated from `.factory/requirements.json`. Each requirement lists its
acceptance criteria, non-goals and planned tests.

## Requirements


### FACTORY-001: Materialize the verbatim original user directive

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - 00-USER-DIRECTIVE.md exists and contains the verbatim directive text unchanged.

Non-goals:

- No paraphrasing or summarization of the directive.

Planned tests:

- Validator DOC_MISSING check covers the required document.

Threats:

- THR-DOC-DRIFT

Evidence:

- docs/backend-factory/00-USER-DIRECTIVE.md


### FACTORY-002: Materialize the complete master mission

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Master mission contains Milestone One through Six and Future Milestone Seven/Eight.

Non-goals:

- No implementation of any backend milestone in Stage Zero.

Planned tests:

- MILESTONE_MISSING and FUTURE_STARTED_TOO_EARLY checks cover the mission.

Threats:

- None

Evidence:

- docs/backend-factory/01-MASTER-MISSION.md


### FACTORY-003: Materialize roadmap and architecture documents

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Roadmap and architecture docs exist and agree with the machine stages and architecture.

Non-goals:

- No production runtime behavior change.

Planned tests:

- MARKDOWN_JSON_MILESTONE_MISMATCH check covers roadmap agreement.

Threats:

- None

Evidence:

- docs/backend-factory/02-BACKEND-ROADMAP.md
- docs/backend-factory/03-ARCHITECTURE.md


### FACTORY-004: Materialize requirements, acceptance and traceability documents

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Requirement, acceptance and traceability tables exist and agree with machine readable requirements.

Non-goals:

- No orphan requirement may be hidden because implementation is difficult.

Planned tests:

- REQ_ID_DUPLICATED, REQ_NO_ACCEPTANCE and REQ_NO_PLANNED_TEST checks cover requirement structure.

Threats:

- THR-DOC-DRIFT

Evidence:

- docs/backend-factory/04-REQUIREMENTS.md
- docs/backend-factory/05-ACCEPTANCE-MATRIX.md
- docs/backend-factory/06-TRACEABILITY-MATRIX.md


### FACTORY-005: Materialize state machine, self-heal and recovery documents

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - State machine documents exist and define the full loop, finite retry limits and recovery state.

Non-goals:

- No production backend code.

Planned tests:

- STATE_SCHEMA_INVALID check covers state schema.

Threats:

- THR-LOOP-DRIFT
- THR-DATA-LOSS

Evidence:

- docs/backend-factory/07-STATE-MACHINE.md
- docs/backend-factory/12-SELF-HEAL-RUNBOOK.md
- docs/backend-factory/13-RECOVERY-RUNBOOK.md


### FACTORY-006: Materialize provider and Ruflo plans

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Provider plan and Ruflo plan exist with selection criteria and optional feature flag.

Non-goals:

- No provider or Ruflo integration.

Planned tests:

- REQ_NO_MILESTONE and REQ_NO_STAGE checks cover plan requirements.

Threats:

- None

Evidence:

- docs/backend-factory/14-PROVIDER-PLAN.md
- docs/backend-factory/15-RUFLO-PLAN.md


### FACTORY-007: Materialize threat model and test strategy

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Threat model maps threats to requirements; test strategy requires red-proof regression tests and no skipped tests.

Non-goals:

- No tests may be skipped or weakened.

Planned tests:

- SECURITY_REQ_NO_THREAT check covers threat mapping.

Threats:

- THR-DOC-DRIFT

Evidence:

- docs/backend-factory/08-THREAT-MODEL.md
- docs/backend-factory/09-TEST-STRATEGY.md


### FACTORY-008: Materialize research and adoption policies

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - N8N and OSS policies exist with forbidden practices and required evidence fields.

Non-goals:

- No workflow may be executed; no remote script may be piped to a shell.

Planned tests:

- STAGE_NO_N8N_GATE check covers n8n research gates.

Threats:

- THR-UNTRUSTED-WORKFLOW
- THR-OSS-PROVENANCE

Evidence:

- docs/backend-factory/10-N8N-RESEARCH-POLICY.md
- docs/backend-factory/11-OSS-ADOPTION-POLICY.md


### FACTORY-009: Produce Finn-loop research evidence

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - evidence/stage-zero/finn-loop-research.md contains all required Finn-loop research fields.

Non-goals:

- Finn-loop must not become a production runtime dependency.

Planned tests:

- Frozen evidence document is covered by MANIFEST_STALE.

Threats:

- None

Evidence:

- docs/backend-factory/evidence/stage-zero/finn-loop-research.md


### FACTORY-010: Inspect relevant n8n workflows safely

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - evidence/stage-zero/n8n-research.md records the inspected SHA, candidates and the explicit rejection or adoption decision.

Non-goals:

- No raw workflows executed; no external URLs or credentials contacted; no MCP connections; no import into n8n.

Planned tests:

- No relevant safe pattern must be forced into the factory design.

Threats:

- THR-UNTRUSTED-WORKFLOW

Evidence:

- docs/backend-factory/evidence/stage-zero/n8n-research.md


### FACTORY-011: Record Taste Skill decision

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - evidence/stage-zero/taste-decision.md records the Expected conclusion Taste gate not applicable to product UI in Stage Zero.

Non-goals:

- Taste must not control backend architecture or security; it must not be added as a production dependency.

Planned tests:

- STAGE_NO_TASTE_DECISION check covers UI-changing stages.

Threats:

- None

Evidence:

- docs/backend-factory/evidence/stage-zero/taste-decision.md


### FACTORY-012: Record external source register

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - evidence/stage-zero/oss-register.md lists external sources with repository, SHA, license and decision.

Non-goals:

- No downloaded binaries committed; no credentials committed.

Planned tests:

- Frozen evidence document is covered by MANIFEST_STALE.

Threats:

- None

Evidence:

- docs/backend-factory/evidence/stage-zero/oss-register.md


### FACTORY-013: Create machine state files

- Milestone: **M0** - Stage: **stage-zero-validate**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Machine files exist, are schema-valid and journal is append-only.

Non-goals:

- No secrets in state or journal.

Planned tests:

- STATE_SCHEMA_INVALID check covers state schema.
- Schema validation tests prove each schema rule.

Threats:

- THR-SECRET

Evidence:

- .factory/state.json
- .factory/journal.jsonl
- .factory/requirements.json
- .factory/stages.json


### FACTORY-014: Create machine schemas

- Milestone: **M0** - Stage: **stage-zero-validate**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - All four schema files exist and are used by the validator.

Non-goals:

- No external network dependency in validation.

Planned tests:

- Schema files are part of the frozen manifest.

Threats:

- None

Evidence:

- .factory/schemas/requirements.schema.json
- .factory/schemas/stages.schema.json
- .factory/schemas/state.schema.json
- .factory/schemas/manifest.schema.json


### FACTORY-015: Create deterministic mission validator

- Milestone: **M0** - Stage: **stage-zero-validate**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Validator detects all enumerated rule failures with meaningful error codes; CLI exits nonzero on failure.

Non-goals:

- No network access; no production code changes.

Planned tests:

- Validator rule coverage is proven by the mutation test file.

Threats:

- None

Evidence:

- scripts/factory/validate-mission.mjs
- scripts/factory/validator.mjs


### FACTORY-016: Create validator mutation tests

- Milestone: **M0** - Stage: **stage-zero-validate**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Each validation rule has a mutation test that asserts the expected error code and message.

Non-goals:

- No snapshot-only reliance; no skipped test.

Planned tests:

- Mutation tests prove every rule.

Threats:

- None

Evidence:

- scripts/factory/validator.test.ts


### FACTORY-017: Add validate:mission package command

- Milestone: **M0** - Stage: **stage-zero-validate**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - npm run validate:mission exits zero on a valid mission and nonzero on invalid mission.

Non-goals:

- No dependency added for the command.

Planned tests:

- The command is covered by Stage Zero verification.

Threats:

- None

Evidence:

- package.json


### FACTORY-018: Add validator to Windows CI

- Milestone: **M0** - Stage: **stage-zero-validate**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - ci-windows.yml runs the mission validator before static analysis.

Non-goals:

- Existing security hardening remains unchanged; actions stay pinned.

Planned tests:

- CI step presence is verified by the repo workflow.
- Windows CI is authoritative for validator execution.

Threats:

- THR-CI-DRIFT

Evidence:

- .github/workflows/ci-windows.yml


### FACTORY-019: Freeze the mission manifest

- Milestone: **M0** - Stage: **stage-zero-freeze**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - manifest.json authenticates every frozen file and fails when a frozen document is altered without a manifest update.

Non-goals:

- Manifest must not hash itself; dynamic state and append-only journal are not hashed.

Planned tests:

- MANIFEST_STALE mutation test proves manifest tampering is detected.

Threats:

- None

Evidence:

- .factory/manifest.json


### FACTORY-020: Run independent mission review

- Milestone: **M0** - Stage: **stage-zero-freeze**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - mission-review.md records reviewer passes, mutation checks, finding counts and zero Critical/High findings.

Non-goals:

- Reviewer must not trust a summary as evidence.

Planned tests:

- Review mutations prove every validation rule.

Threats:

- None

Evidence:

- docs/backend-factory/evidence/stage-zero/mission-review.md


### FACTORY-021: Document Soup as a future milestone

- Milestone: **M0** - Stage: **m7-soup-routing**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Soup is documented in the master mission and blocked in the machine state.

Non-goals:

- No Soup implementation, no early start.

Planned tests:

- FUTURE_STARTED_TOO_EARLY check covers future milestones.

Threats:

- None

Evidence:

- docs/backend-factory/01-MASTER-MISSION.md
- docs/backend-factory/02-BACKEND-ROADMAP.md


### FACTORY-022: Document OmniRoute as a future milestone

- Milestone: **M0** - Stage: **m8-omni-route**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - OmniRoute is documented in the master mission and blocked in the machine state.

Non-goals:

- No OmniRoute implementation, no early start.

Planned tests:

- FUTURE_STARTED_TOO_EARLY check covers future milestones.

Threats:

- None

Evidence:

- docs/backend-factory/01-MASTER-MISSION.md
- docs/backend-factory/02-BACKEND-ROADMAP.md


### JCODE-001: Verify the official Jcode repository

- Milestone: **M1** - Stage: **m1-jcode-compat**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - The official repository identity, default branch and upstream commit are recorded as frozen evidence.

Non-goals:

- No Jcode binary is downloaded or executed in Stage Zero.

Planned tests:

- Unit test verifies repository metadata parsing.
- Integration test verifies pinned version resolution.
- Windows test collects official binary metadata.

Threats:

- THR-SUPPLY-CHAIN

Evidence:

- No evidence yet (planned).


### JCODE-002: Verify the Jcode license

- Milestone: **M1** - Stage: **m1-jcode-compat**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - License is recorded and an ADR is created when a forbidden license is encountered.

Non-goals:

- No incompatible license may be silently accepted.

Planned tests:

- Unit test covers license classification.

Threats:

- THR-LICENSE

Evidence:

- No evidence yet (planned).


### JCODE-003: Select a stable Jcode version and supported architectures

- Milestone: **M1** - Stage: **m1-jcode-compat**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - A pinned version and architecture matrix are documented in an ADR that includes Windows support.

Non-goals:

- No mutable latest or rolling source may be used.

Planned tests:

- Unit test validates version selection constraints.
- Windows architecture test validates supported target.

Threats:

- THR-SUPPLY-CHAIN

Evidence:

- No evidence yet (planned).


### JCODE-004: Machine-readable execution and structured event output

- Milestone: **M1** - Stage: **m1-jcode-compat**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - A stable machine-readable event schema is frozen with sequence numbers and deduplication identifiers.

Non-goals:

- No scraping of a visual terminal interface may be used.

Planned tests:

- Event parser unit tests cover valid and malformed frames.
- Protocol integration test covers session resume and streaming.

Threats:

- THR-PROTOCOL-DRIFT

Evidence:

- No evidence yet (planned).


### JCODE-005: Jcode headless lifecycle capabilities

- Milestone: **M1** - Stage: **m1-jcode-compat**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Every lifecycle capability is represented by a fixture test and a protocol ADR.

Non-goals:

- No terminal driver or screen scraping.

Planned tests:

- Lifecycle fixture tests cover create, resume, stream and cancel.
- Integration test drives the headless run end to end.

Threats:

- THR-PROTOCOL-DRIFT

Evidence:

- No evidence yet (planned).


### JCODE-006: Provider authentication handoff and diagnostics commands

- Milestone: **M1** - Stage: **m1-jcode-compat**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Authentication handoff and diagnostics command behaviors are documented with exit code and stream guarantees.

Non-goals:

- No credentials are stored by the protocol layer.

Planned tests:

- Unit tests cover auth handoff state transitions.
- Integration test verifies health and version output.

Threats:

- THR-AUTH-HANDOFF

Evidence:

- No evidence yet (planned).


### JCODE-007: Configuration locations and output guarantees

- Milestone: **M1** - Stage: **m1-jcode-compat**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Configuration locations are documented and stdout/stderr/exit-code guarantees are enforced by tests.

Non-goals:

- No shell interpolation of Jcode output.

Planned tests:

- Config resolution unit tests cover platform locations.
- Windows config path tests.

Threats:

- THR-PROTOCOL-DRIFT
- THR-OUTPUT-LEAK

Evidence:

- No evidence yet (planned).


### JCODE-008: Version policy and no terminal scraping

- Milestone: **M1** - Stage: **m1-jcode-compat**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Supported-version policy and non-scraping rule are documented and validator-enforced.

Non-goals:

- No attempt to parse a visual terminal matrix.

Planned tests:

- Unit test classifies supported and unsupported versions.

Threats:

- THR-PROTOCOL-DRIFT

Evidence:

- No evidence yet (planned).


### JCODE-009: Compatibility fixtures and Windows evidence

- Milestone: **M1** - Stage: **m1-jcode-compat**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Compatibility fixtures, ADR and Windows evidence exist and are referenced from the acceptance matrix.

Non-goals:

- No real Windows hardware evidence may be fabricated.

Planned tests:

- Fixture parser unit tests pass.
- Compatibility test runs against fixture streams.
- Windows evidence recorded as a manual or CI gate.

Threats:

- None

Evidence:

- No evidence yet (planned).


### INSTALL-001: Managed Jcode binary discovery

- Milestone: **M2** - Stage: **m2-install-supervisor**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Discovery prefers an explicit configured executable path and records the resolved pinned version.

Non-goals:

- No administrator elevation and no uncontrolled PATH mutation.

Planned tests:

- Discovery unit tests cover precedence and absence.
- Windows PATH and per-user install discovery tests.

Threats:

- THR-SUPPLY-CHAIN

Evidence:

- No evidence yet (planned).


### INSTALL-002: Trusted download and atomic installation

- Milestone: **M2** - Stage: **m2-install-supervisor**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Checksum mismatch aborts; interrupted downloads are recoverable; failed installs roll back to the previous version.

Non-goals:

- No mutable binary URLs; no piping remote scripts into a shell.

Planned tests:

- Installer unit tests cover checksum, atomicity and rollback.
- Integration test simulates interrupted download recovery.
- Windows install/uninstall recovery test.

Threats:

- THR-SUPPLY-CHAIN
- THR-SECRET

Evidence:

- No evidence yet (planned).


### INSTALL-003: Architecture detection and version compatibility

- Milestone: **M2** - Stage: **m2-install-supervisor**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Unsupported architectures and incompatible versions fail with actionable diagnostics.

Non-goals:

- No silent fallback to an untrusted source.

Planned tests:

- Architecture detection unit tests cover supported targets.
- Windows x64 and arm64 detection tests.

Threats:

- THR-SUPPLY-CHAIN

Evidence:

- No evidence yet (planned).


### SUPERVISOR-001: Safe process spawning

- Milestone: **M2** - Stage: **m2-install-supervisor**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - The supervisor never invokes a shell for user input and passes arguments as separate strings; the child environment is allowlisted.

Non-goals:

- No shell interpolation.

Planned tests:

- Spawn unit tests assert argument separation and env allowlist.

Threats:

- THR-INJECTION
- THR-PROCESS-ESCAPE

Evidence:

- No evidence yet (planned).


### SUPERVISOR-002: Working directory and path validation

- Milestone: **M2** - Stage: **m2-install-supervisor**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - The supervisor resolves canonical paths and rejects escapes; Windows junctions are denied by default.

Non-goals:

- No follower of untrusted symlinks into arbitrary directories.

Planned tests:

- Path validation unit tests cover canonicalization and junction escape.
- Windows junction escape test.

Threats:

- THR-PATH-TRAVERSAL
- THR-PROCESS-ESCAPE

Evidence:

- No evidence yet (planned).


### SUPERVISOR-003: Streaming with bounded buffers and timeout

- Milestone: **M2** - Stage: **m2-install-supervisor**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Output buffers are bounded, backpressure is applied and runs time out rather than hanging.

Non-goals:

- No unbounded accumulation.

Planned tests:

- Stream unit tests cover bounded buffers and backpressure.
- Integration test covers timeout.

Threats:

- THR-RESOURCE-EXHAUSTION

Evidence:

- No evidence yet (planned).


### SUPERVISOR-004: Graceful cancellation and forced termination

- Milestone: **M2** - Stage: **m2-install-supervisor**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Cancellation first asks for graceful exit, then terminates the whole process tree; Windows tree termination is covered.

Non-goals:

- No orphaned children.

Planned tests:

- Cancellation unit tests cover graceful and forced paths.
- Integration test verifies no orphan remains.
- Windows process-tree termination test.

Threats:

- THR-PROCESS-ESCAPE
- THR-RESOURCE-EXHAUSTION

Evidence:

- No evidence yet (planned).


### SUPERVISOR-005: Crash detection, orphan cleanup, restart and diagnostics

- Milestone: **M2** - Stage: **m2-install-supervisor**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Crashes are detected, orphans are cleaned, restart policy is bounded and diagnostics redact secrets.

Non-goals:

- No credential may appear in diagnostics.

Planned tests:

- Diagnostics redaction unit tests cover secret patterns.
- Windows crash and orphan cleanup test.

Threats:

- THR-SECRET
- THR-ORPHAN

Evidence:

- No evidence yet (planned).


### IPC-001: Provider-neutral typed Tauri commands

- Milestone: **M3** - Stage: **m3-tauri-ipc**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Every Tauri command has typed Rust and TypeScript payloads and provider-neutral names.

Non-goals:

- No provider-specific command may enter IPC.

Planned tests:

- Payload validation unit tests exercise typed contracts.
- IPC integration test exercises commands through the bridge.

Threats:

- THR-PROTOCOL-DRIFT

Evidence:

- No evidence yet (planned).


### IPC-002: Stable error codes and validation across IPC

- Milestone: **M3** - Stage: **m3-tauri-ipc**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Error codes are stable and documented; invalid payloads return coded errors; no panic reaches JavaScript.

Non-goals:

- No silent fallback for an unknown error.

Planned tests:

- Error code unit tests cover every defined code.
- Integration test sends malformed payloads.

Threats:

- THR-PROTOCOL-DRIFT

Evidence:

- No evidence yet (planned).


### IPC-003: Bounded queues and listener lifecycle

- Milestone: **M3** - Stage: **m3-tauri-ipc**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Event queues are bounded, listeners are removed on teardown and repeated mounting does not leak.

Non-goals:

- No unbounded event accumulation.

Planned tests:

- Queue and listener unit tests cover bounds and cleanup.

Threats:

- THR-RESOURCE-EXHAUSTION

Evidence:

- No evidence yet (planned).


### IPC-004: Runtime health and capability discovery

- Milestone: **M3** - Stage: **m3-tauri-ipc**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - The UI receives typed runtime health, capability and version state without provider assumptions.

Non-goals:

- No runtime-specific UI logic.

Planned tests:

- Runtime info mapper unit tests cover states.
- Integration test verifies detection through the bridge.

Threats:

- None

Evidence:

- No evidence yet (planned).


### IPC-005: Runtime operations over IPC

- Milestone: **M3** - Stage: **m3-tauri-ipc**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - All runtime operations are available as typed commands and backed by tests.

Non-goals:

- No direct UI access to the process supervisor.

Planned tests:

- Operation request/response unit tests cover every command.
- Integration test covers the operation sequence.

Threats:

- None

Evidence:

- No evidence yet (planned).


### IPC-006: Retain mock runtime and independent CI

- Milestone: **M3** - Stage: **m3-tauri-ipc**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Mock runtime remains the browser preview default; CI tests pass without a real Jcode installation.

Non-goals:

- No CI dependency on a real Jcode binary.

Planned tests:

- Selection unit tests cover mock default and real selection.
- Mock transport integration tests remain green.

Threats:

- None

Evidence:

- No evidence yet (planned).


### EVENT-001: Normalize Jcode events with a versioned schema

- Milestone: **M4** - Stage: **m4-events-lifecycle**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Every event has a schema version, sequence number and deduplication key; malformed events are rejected.

Non-goals:

- No raw Jcode event reaches the UI.

Planned tests:

- Normalization unit tests cover ordering, sequence and dedupe.

Threats:

- THR-EVENT-DRIFT

Evidence:

- No evidence yet (planned).


### EVENT-002: Event and tool correlation

- Milestone: **M4** - Stage: **m4-events-lifecycle**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Correlation fields are required and partial or unknown events are classified safely.

Non-goals:

- No unvalidated event data may be emitted.

Planned tests:

- Correlation unit tests cover malformed and unknown events.
- Windows partial frame test.

Threats:

- THR-EVENT-DRIFT

Evidence:

- No evidence yet (planned).


### EVENT-003: Duplicate completion, stale events and isolation

- Milestone: **M4** - Stage: **m4-events-lifecycle**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Duplicate completion is idempotent; stale events are dropped; no event leaks across sessions or runs.

Non-goals:

- No cross-run correlation leakage.

Planned tests:

- Isolation unit tests cover duplicate and stale events.

Threats:

- THR-EVENT-DRIFT

Evidence:

- No evidence yet (planned).


### SESSION-001: Session resume and interrupted session handling

- Milestone: **M4** - Stage: **m4-events-lifecycle**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Interrupted sessions resume without duplicate messages and partial responses are preserved or clearly marked.

Non-goals:

- Recovery must never discard uncommitted user changes.

Planned tests:

- Session resume unit tests cover partial state.
- Integration test simulates crash and restart.
- Windows restart and shutdown test.

Threats:

- THR-DATA-LOSS

Evidence:

- No evidence yet (planned).


### CANCEL-001: Cancellation across run phases

- Milestone: **M4** - Stage: **m4-events-lifecycle**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Every cancellation phase is covered by a deterministic test and cancels the underlying Jcode run.

Non-goals:

- No cancellation that leaves a run running.

Planned tests:

- Cancellation phase unit tests cover all four phases.
- Integration test covers cancellation during streaming.

Threats:

- THR-ORPHAN

Evidence:

- No evidence yet (planned).


### APPROVAL-001: Backend-enforced approvals and permissions

- Milestone: **M4** - Stage: **m4-events-lifecycle**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Approval requests are backend-enforced; default permissions are least privilege.

Non-goals:

- No frontend-only approval gate.

Planned tests:

- Approval policy unit tests cover safe defaults.

Threats:

- THR-APPROVAL-BYPASS

Evidence:

- No evidence yet (planned).


### APPROVAL-002: Stale and duplicate approval rejection

- Milestone: **M4** - Stage: **m4-events-lifecycle**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - A stale or duplicate approval resolution is rejected with a coded error and no action runs twice.

Non-goals:

- No out-of-order approval may apply.

Planned tests:

- Stale approval unit tests cover duplicate and expired resolutions.

Threats:

- THR-APPROVAL-BYPASS

Evidence:

- No evidence yet (planned).


### RECOVERY-001: Recovery state machine and deterministic tests

- Milestone: **M4** - Stage: **m4-events-lifecycle**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Recovery state machine is deterministic and covered by deterministic recovery tests.

Non-goals:

- No nondeterministic recovery ordering.

Planned tests:

- Recovery state machine unit tests cover every transition.
- Integration test drives recovery scenarios.
- Windows lifecycle recovery test.

Threats:

- THR-DATA-LOSS

Evidence:

- No evidence yet (planned).


### RECOVERY-002: Runtime and application lifecycle recovery

- Milestone: **M4** - Stage: **m4-events-lifecycle**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Recovery evidence shows no loss of uncommitted user changes and a safe resume path.

Non-goals:

- Recovery must never discard uncommitted user changes.

Planned tests:

- Lifecycle recovery unit tests cover crash and restart.
- Integration test covers shutdown persistence.
- Windows lifecycle test.

Threats:

- THR-DATA-LOSS

Evidence:

- No evidence yet (planned).


### PROVIDER-001: Provider capability and model discovery

- Milestone: **M5** - Stage: **m5-provider-onboarding**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Provider and model capabilities are discovered through Jcode and surfaced as typed descriptors.

Non-goals:

- No second provider client where Jcode already supports it.

Planned tests:

- Discovery unit tests cover capabilities and diagnostics.

Threats:

- THR-SUPPLY-CHAIN

Evidence:

- No evidence yet (planned).


### PROVIDER-002: Fake provider testing and no duplicate clients

- Milestone: **M5** - Stage: **m5-provider-onboarding**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Fake provider testing covers provider behaviors; no duplicate client exists in the runtime.

Non-goals:

- No bypass of the Jcode provider boundary.

Planned tests:

- Fake provider unit tests cover success and failure.
- Fake provider integration test covers the full flow.

Threats:

- None

Evidence:

- No evidence yet (planned).


### PROVIDER-003: Research and select first provider order

- Milestone: **M5** - Stage: **m5-provider-onboarding**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Provider choice is backed by an accepted research note that records the first provider selection criterion.

Non-goals:

- No provider is enabled before the selection evidence is reviewed.

Planned tests:

- Selection test validates the decision gate.

Threats:

- None

Evidence:

- No evidence yet (planned).


### AUTH-001: Officially supported authentication modes

- Milestone: **M5** - Stage: **m5-provider-onboarding**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Each supported authentication mode has a deterministic test and a documented error result.

Non-goals:

- No storage of raw tokens outside the backend handoff.

Planned tests:

- Authentication state machine unit tests cover all outcomes.
- Integration test verifies device-code handoff.

Threats:

- THR-AUTH-HANDOFF
- THR-SECRET

Evidence:

- No evidence yet (planned).


### AUTH-002: Logout handoff and unavailable provider handling

- Milestone: **M5** - Stage: **m5-provider-onboarding**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Logout clears backend-held auth state; unavailable providers are reported with no partial UI state.

Non-goals:

- No credentials in browser events.

Planned tests:

- Logout unit tests cover clearing and unavailable states.

Threats:

- THR-AUTH-HANDOFF

Evidence:

- No evidence yet (planned).


### AUTH-003: Credential hygiene across the runtime

- Milestone: **M5** - Stage: **m5-provider-onboarding**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Credential leak assertions pass across all transport layers and diagnostics.

Non-goals:

- No raw token in React, localStorage, events, diagnostics or CI.

Planned tests:

- Redaction unit tests cover every transport sink.
- Integration test asserts no credential in event payloads.

Threats:

- THR-SECRET

Evidence:

- No evidence yet (planned).


### AUTH-004: Real Windows validation as a manual release gate

- Milestone: **M5** - Stage: **m5-provider-onboarding**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - A manual release checklist records real Windows validation before providers ship.

Non-goals:

- No claim of real Windows validation without evidence.

Planned tests:

- Windows manual validation gate documented in the acceptance matrix.

Threats:

- THR-CI-DRIFT

Evidence:

- No evidence yet (planned).


### RUFLO-001: Verify Ruflo repository and license

- Milestone: **M6** - Stage: **m6-ruflo-orchestration**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Ruflo provenance, license and supported Jcode integration boundary are recorded in frozen evidence.

Non-goals:

- Ruflo remains optional; ordinary Jcode mode must not be blocked.

Planned tests:

- Ruflo metadata parser unit tests.

Threats:

- THR-LICENSE
- THR-SUPPLY-CHAIN

Evidence:

- No evidence yet (planned).


### RUFLO-002: Ruflo protocol and managed install

- Milestone: **M6** - Stage: **m6-ruflo-orchestration**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Ruflo protocol boundary and install policy are documented; no terminal scraping is permitted.

Non-goals:

- No mutable Ruflo releases or remote scripts.

Planned tests:

- Ruflo protocol schema unit tests.

Threats:

- THR-PROTOCOL-DRIFT
- THR-SUPPLY-CHAIN

Evidence:

- No evidence yet (planned).


### RUFLO-003: Ruflo agent roles, task graph and swarm lifecycle

- Milestone: **M6** - Stage: **m6-ruflo-orchestration**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Agent roles and task graph execute within discrete concurrency limits and cancellable swarm runs.

Non-goals:

- No unbounded agent swarm.

Planned tests:

- Orchestrator unit tests cover roles, graph and cancellation.
- Swarm lifecycle integration test.

Threats:

- THR-RESOURCE-EXHAUSTION

Evidence:

- No evidence yet (planned).


### RUFLO-004: Ruflo failure, cost and audit controls

- Milestone: **M6** - Stage: **m6-ruflo-orchestration**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Partial failure recovers, cost and resource controls are bounded and an audit trail records orchestration decisions.

Non-goals:

- No uncontrolled cost or resource use.

Planned tests:

- Recovery and audit unit tests cover partial failure.

Threats:

- THR-DATA-LOSS
- THR-RESOURCE-EXHAUSTION

Evidence:

- No evidence yet (planned).


### RUFLO-005: Optional Ruflo feature flag and safe fallback

- Milestone: **M6** - Stage: **m6-ruflo-orchestration**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Ruflo is disabled by default, falls back to normal Jcode mode and uses default limits safe for 16 GiB systems.

Non-goals:

- Ruflo failure must never block ordinary Jcode mode.

Planned tests:

- Feature flag unit tests cover enabled, disabled and fallback.
- Integration test proves Jcode mode works without Ruflo.
- Windows validation test with 16 GiB defaults.

Threats:

- None

Evidence:

- No evidence yet (planned).


### SECURITY-001: Cross-cutting secret redaction and hygiene policy

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Secret-redaction assertions exist across diagnostics, IPC, CI and docs.

Non-goals:

- No credentials committed or logged.

Planned tests:

- Redaction policy tests.

Threats:

- THR-SECRET

Evidence:

- No evidence yet (planned).


### SECURITY-002: Cross-cutting open source dependency controls

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - The OSS policy forbids each listed practice and requires the review fields.

Non-goals:

- No AGPL, BUSL or source-available license without explicit approval.

Planned tests:

- Policy tests.

Threats:

- THR-OSS-PROVENANCE
- THR-SUPPLY-CHAIN

Evidence:

- No evidence yet (planned).


### TEST-001: Regression-red proof test discipline

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Every real defect has a regression test proven red before fix.

Non-goals:

- No timeouts increased without evidence; no weakened assertions; no deleted failing tests.

Planned tests:

- Regression discipline tests.

Threats:

- None

Evidence:

- No evidence yet (planned).


### TEST-002: Windows CI as authoritative runtime evidence

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Windows CI results are the authority for Windows behavior; local browser unavailability is not claimed as Playwright success.

Non-goals:

- No local Playwright success claim without a browser.

Planned tests:

- CI evidence policy tests.
- Windows CI is authoritative.

Threats:

- THR-CI-DRIFT

Evidence:

- No evidence yet (planned).


### N8N-001: N8n research policy for every stage

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - Every stage has an n8n research gate and the policy forbids executing, importing, connecting or contacting workflow contents.

Non-goals:

- No workflow text may override this mission.

Planned tests:

- STAGE_NO_N8N_GATE check.

Threats:

- THR-UNTRUSTED-WORKFLOW

Evidence:

- No evidence yet (planned).


### OSS-001: OSS provenance and adoption register

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **yes**

Acceptance criteria:

- [ ] AC-1 - OSS register covers adopted and inspected sources; no dependency for a trivial utility.

Non-goals:

- No large vendored repositories or downloaded binaries committed.

Planned tests:

- OSS policy tests.

Threats:

- THR-OSS-PROVENANCE

Evidence:

- No evidence yet (planned).


### TASTE-001: Taste governance boundary

- Milestone: **M0** - Stage: **stage-zero-materialize**
- Status: **planned** - Security sensitive: **no**

Acceptance criteria:

- [ ] AC-1 - Taste decisions exist for UI-changing stages and a taste gate is recorded for each.

Non-goals:

- Taste is not added as a production dependency.

Planned tests:

- STAGE_NO_TASTE_DECISION check.

Threats:

- None

Evidence:

- No evidence yet (planned).

