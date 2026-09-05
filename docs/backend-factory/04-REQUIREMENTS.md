# Backend Factory Requirements

Machine readable source: `.factory/requirements.json`.
Status vocabulary: `planned`, `in-progress`, `complete`, `blocked`. No backend
implementation requirement is marked complete without reproducible evidence.

## Requirement count

Total: 75 requirements.

## Stage Zero and cross-cutting

| ID | Title | Milestone | Stage | Status | Kind |
| --- | --- | --- | --- | --- | --- |
| FACTORY-001 | Materialize the verbatim original user directive | M0 | stage-zero-materialize | complete | factory |
| FACTORY-002 | Materialize the complete master mission | M0 | stage-zero-materialize | complete | factory |
| FACTORY-003 | Materialize roadmap and architecture documents | M0 | stage-zero-materialize | complete | factory |
| FACTORY-004 | Materialize requirements, acceptance and traceability documents | M0 | stage-zero-materialize | complete | factory |
| FACTORY-005 | Materialize state machine, self-heal and recovery documents | M0 | stage-zero-materialize | complete | factory |
| FACTORY-006 | Materialize provider and Ruflo plans | M0 | stage-zero-materialize | complete | factory |
| FACTORY-007 | Materialize threat model and test strategy | M0 | stage-zero-materialize | complete | factory |
| FACTORY-008 | Materialize research and adoption policies | M0 | stage-zero-materialize | complete | factory |
| FACTORY-009 | Produce Finn-loop research evidence | M0 | stage-zero-materialize | complete | factory |
| FACTORY-010 | Inspect relevant n8n workflows safely | M0 | stage-zero-materialize | complete | factory |
| FACTORY-011 | Record Taste Skill decision | M0 | stage-zero-materialize | complete | factory |
| FACTORY-012 | Record external source register | M0 | stage-zero-materialize | complete | factory |
| FACTORY-013 | Create machine state files | M0 | stage-zero-validate | complete | factory |
| FACTORY-014 | Create machine schemas | M0 | stage-zero-validate | complete | factory |
| FACTORY-015 | Create deterministic mission validator | M0 | stage-zero-validate | complete | factory |
| FACTORY-016 | Create validator mutation tests | M0 | stage-zero-validate | complete | factory |
| FACTORY-017 | Add validate:mission package command | M0 | stage-zero-validate | complete | factory |
| FACTORY-018 | Add validator to Windows CI | M0 | stage-zero-validate | complete | factory |
| FACTORY-019 | Freeze the mission manifest | M0 | stage-zero-freeze | complete | factory |
| FACTORY-020 | Run independent mission review | M0 | stage-zero-freeze | in-progress | factory |
| FACTORY-021 | Document Soup as a future milestone | M0 | stage-zero-materialize | complete | factory |
| FACTORY-022 | Document OmniRoute as a future milestone | M0 | stage-zero-materialize | complete | factory |
| N8N-001 | N8n research policy for every stage | M0 | stage-zero-materialize | complete | factory |
| OSS-001 | OSS provenance and adoption register | M0 | stage-zero-materialize | complete | factory |
| SECURITY-001 | Cross-cutting secret redaction and hygiene policy | M0 | stage-zero-materialize | complete | factory |
| SECURITY-002 | Cross-cutting open source dependency controls | M0 | stage-zero-materialize | complete | factory |
| TASTE-001 | Taste governance boundary | M0 | stage-zero-materialize | complete | factory |
| TEST-001 | Regression-red proof test discipline | M0 | stage-zero-materialize | complete | factory |
| TEST-002 | Windows CI as authoritative runtime evidence | M0 | stage-zero-materialize | complete | factory |

## Milestone One

| ID | Title | Milestone | Stage | Status | Kind |
| --- | --- | --- | --- | --- | --- |
| JCODE-001 | Verify the official Jcode repository | M1 | m1-jcode-compat | planned | implementation |
| JCODE-002 | Verify the Jcode license | M1 | m1-jcode-compat | planned | implementation |
| JCODE-003 | Select a stable Jcode version and supported architectures | M1 | m1-jcode-compat | planned | implementation |
| JCODE-004 | Machine-readable execution and structured event output | M1 | m1-jcode-compat | planned | implementation |
| JCODE-005 | Jcode headless lifecycle capabilities | M1 | m1-jcode-compat | planned | implementation |
| JCODE-006 | Provider authentication handoff and diagnostics commands | M1 | m1-jcode-compat | planned | implementation |
| JCODE-007 | Configuration locations and output guarantees | M1 | m1-jcode-compat | planned | implementation |
| JCODE-008 | Version policy and no terminal scraping | M1 | m1-jcode-compat | planned | implementation |
| JCODE-009 | Compatibility fixtures and Windows evidence | M1 | m1-jcode-compat | planned | implementation |

## Milestone Two

| ID | Title | Milestone | Stage | Status | Kind |
| --- | --- | --- | --- | --- | --- |
| INSTALL-001 | Managed Jcode binary discovery | M2 | m2-install-supervisor | planned | implementation |
| INSTALL-002 | Trusted download and atomic installation | M2 | m2-install-supervisor | planned | implementation |
| INSTALL-003 | Architecture detection and version compatibility | M2 | m2-install-supervisor | planned | implementation |
| SUPERVISOR-001 | Safe process spawning | M2 | m2-install-supervisor | planned | implementation |
| SUPERVISOR-002 | Working directory and path validation | M2 | m2-install-supervisor | planned | implementation |
| SUPERVISOR-003 | Streaming with bounded buffers and timeout | M2 | m2-install-supervisor | planned | implementation |
| SUPERVISOR-004 | Graceful cancellation and forced termination | M2 | m2-install-supervisor | planned | implementation |
| SUPERVISOR-005 | Crash detection, orphan cleanup, restart and diagnostics | M2 | m2-install-supervisor | planned | implementation |

## Milestone Three

| ID | Title | Milestone | Stage | Status | Kind |
| --- | --- | --- | --- | --- | --- |
| IPC-001 | Provider-neutral typed Tauri commands | M3 | m3-tauri-ipc | planned | implementation |
| IPC-002 | Stable error codes and validation across IPC | M3 | m3-tauri-ipc | planned | implementation |
| IPC-003 | Bounded queues and listener lifecycle | M3 | m3-tauri-ipc | planned | implementation |
| IPC-004 | Runtime health and capability discovery | M3 | m3-tauri-ipc | planned | implementation |
| IPC-005 | Runtime operations over IPC | M3 | m3-tauri-ipc | planned | implementation |
| IPC-006 | Retain mock runtime and independent CI | M3 | m3-tauri-ipc | planned | implementation |

## Milestone Four

| ID | Title | Milestone | Stage | Status | Kind |
| --- | --- | --- | --- | --- | --- |
| APPROVAL-001 | Backend-enforced approvals and permissions | M4 | m4-events-lifecycle | planned | implementation |
| APPROVAL-002 | Stale and duplicate approval rejection | M4 | m4-events-lifecycle | planned | implementation |
| CANCEL-001 | Cancellation across run phases | M4 | m4-events-lifecycle | planned | implementation |
| EVENT-001 | Normalize Jcode events with a versioned schema | M4 | m4-events-lifecycle | planned | implementation |
| EVENT-002 | Event and tool correlation | M4 | m4-events-lifecycle | planned | implementation |
| EVENT-003 | Duplicate completion, stale events and isolation | M4 | m4-events-lifecycle | planned | implementation |
| RECOVERY-001 | Recovery state machine and deterministic tests | M4 | m4-events-lifecycle | planned | implementation |
| RECOVERY-002 | Runtime and application lifecycle recovery | M4 | m4-events-lifecycle | planned | implementation |
| SESSION-001 | Session resume and interrupted session handling | M4 | m4-events-lifecycle | planned | implementation |

## Milestone Five

| ID | Title | Milestone | Stage | Status | Kind |
| --- | --- | --- | --- | --- | --- |
| AUTH-001 | Officially supported authentication modes | M5 | m5-provider-onboarding | planned | implementation |
| AUTH-002 | Logout handoff and unavailable provider handling | M5 | m5-provider-onboarding | planned | implementation |
| AUTH-003 | Credential hygiene across the runtime | M5 | m5-provider-onboarding | planned | implementation |
| AUTH-004 | Real Windows validation as a manual release gate | M5 | m5-provider-onboarding | planned | implementation |
| PROVIDER-001 | Provider capability and model discovery | M5 | m5-provider-onboarding | planned | implementation |
| PROVIDER-002 | Fake provider testing and no duplicate clients | M5 | m5-provider-onboarding | planned | implementation |
| PROVIDER-003 | Research and select first provider order | M5 | m5-provider-onboarding | planned | implementation |

## Milestone Six

| ID | Title | Milestone | Stage | Status | Kind |
| --- | --- | --- | --- | --- | --- |
| RUFLO-001 | Verify Ruflo repository and license | M6 | m6-ruflo-orchestration | planned | implementation |
| RUFLO-002 | Ruflo protocol and managed install | M6 | m6-ruflo-orchestration | planned | implementation |
| RUFLO-003 | Ruflo agent roles, task graph and swarm lifecycle | M6 | m6-ruflo-orchestration | planned | implementation |
| RUFLO-004 | Ruflo failure, cost and audit controls | M6 | m6-ruflo-orchestration | planned | implementation |
| RUFLO-005 | Optional Ruflo feature flag and safe fallback | M6 | m6-ruflo-orchestration | planned | implementation |

## Future milestones

| ID | Title | Milestone | Stage | Status | Kind |
| --- | --- | --- | --- | --- | --- |
| OMNIROUTE-001 | OmniRoute provider routing future placeholder | M8 | m8-omni-route | planned | future |
| SOUP-001 | Soup skill routing future placeholder | M7 | m7-soup-routing | planned | future |

