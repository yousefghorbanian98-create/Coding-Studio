# Backend Factory Threat Model

A `THR-*` identifier names a threat. Every security-sensitive requirement
maps to at least one threat in `.factory/requirements.json`. Storage of the
mapping in the machine-readable mission is verified by
`scripts/factory/validate-mission.mjs`. This document is generated from
`.factory/threats.json`; the validator compares it with the catalog.

## Threat register

| ID | Title | Description | Primary controls |
| --- | --- | --- | --- |
| THR-APPROVAL-BYPASS | Approval bypass | An action proceeds without backend-approved permission or reuses a stale approval. | Backend-enforced approvals, safe defaults, stale and duplicate approval rejection. |
| THR-AUTH-HANDOFF | Authentication handoff abuse | Handoff leaks credentials or allows unauthorized provider access. | Backend auth handoff, logout clearing state, credential hygiene assertions. |
| THR-CI-DRIFT | CI gate drift | CI stops validating the mission or weakens existing security hardening. | Validator in existing Windows CI, pinned actions, no weakened assertions. |
| THR-DATA-LOSS | Loss of user work | Crash, restart or recovery discards uncommitted user changes. | Recovery state machine, resume preserving partial responses, no destructive reset. |
| THR-DOC-DRIFT | Document and machine state drift | Requirements, acceptance criteria or evidence diverge from the frozen mission. | Deterministic validator, frozen manifest, ADR on change. |
| THR-EVENT-DRIFT | Event corruption | Malformed, partial, duplicate or stale events corrupt session state. | Normalization, schema version, sequence, dedup, correlation, isolation. |
| THR-INJECTION | Command or script injection | User or Jcode input reaches a shell, script or dynamic eval. | Shell-free spawn, argument separation, environment allowlist, no remote script piping. |
| THR-LICENSE | Incompatible license | License forbids use or requires obligations no one has approved. | License verification, explicit approval for AGPL, BUSL and source-available licenses. |
| THR-LOOP-DRIFT | Autonomous loop drift | The loop performs unapproved work without gates or limits. | Finite retry limits, circuit breakers, role separation, human-controlled gates. |
| THR-ORPHAN | Orphaned child process | Cancellation or crash leaves a child process running. | Graceful cancellation, forced termination, Windows process-tree termination, orphan cleanup. |
| THR-OSS-PROVENANCE | Unreviewed open source | Mutable releases, unattributed code, forced dependency, unknown license. | OSS adoption policy with provenance fields and forbidden practices. |
| THR-OUTPUT-LEAK | Output leak into unexpected channel | Jcode stdout/stderr or diagnostics leak into the UI or logs without redaction. | stdout/stderr contracts, bounded separators, diagnostic redaction. |
| THR-PATH-TRAVERSAL | Path traversal | Symlink or junction escape reads or writes outside the workspace. | Canonical path resolution, junction escape protection. |
| THR-PROCESS-ESCAPE | Child process escape | Spawned process escapes the intended working directory or tree. | Canonical paths, working directory validation, process-tree termination, orphan cleanup. |
| THR-PROTOCOL-DRIFT | Protocol instability | Jcode protocol or event schema changes without a versioned contract. | Frozen schema, sequence numbers, deduplication, protocol stability tests. |
| THR-RESOURCE-EXHAUSTION | Resource exhaustion | Unbounded buffers, concurrency, queues, cost or memory starve the host. | Bounded buffers, backpressure, timeouts, concurrency and resource limits, cost controls. |
| THR-SECRET | Secret exposure | Credentials reach logs, events, Git, CI, localStorage or React state. | Secret redaction, credential hygiene, no credentials in Git, CI and events. |
| THR-SUPPLY-CHAIN | Supply chain compromise | Downloaded runtime or dependency is not the verified official artifact. | Official repo verification, pinned versions, checksum verification, atomic install. |
| THR-UNTRUSTED-WORKFLOW | Untrusted n8n workflow | Workflow contents include credentials, code, URLs, MCP servers or prompt injection. | Treat as untrusted input; never execute, import, connect or copy blindly; n8n research gate. |

## How threats are used

- A requirement marked `securitySensitive` must reference at least one threat.
- Every threat above is referenced by at least one requirement.
- Adding or removing a threat is a mission change and requires an ADR plus a
  manifest update.
