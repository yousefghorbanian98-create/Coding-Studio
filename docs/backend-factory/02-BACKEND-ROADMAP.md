# Backend Roadmap

This roadmap is the human readable summary of `.factory/stages.json`. It agrees
with the machine readable milestones.

Status values: `planned`, `active`, `complete`, `future`, `blocked`.

## Milestones

| # | Milestone | Stage | Status | Gate after completion |
| --- | --- | --- | --- | --- |
| 0 | Backend Factory Stage Zero | stage-zero-freeze | active | Independent review and Draft PR |
| 1 | Jcode compatibility and stable machine protocol | m1-jcode-compat | planned | Frozen protocol ADR, Windows evidence |
| 2 | Managed Jcode installation and Rust process supervisor | m2-install-supervisor | planned | Install and supervisor security review |
| 3 | Tauri IPC and StudioRuntimeBridge integration | m3-tauri-ipc | planned | Typed IPC review, CI without real Jcode |
| 4 | Event normalization, sessions, approvals, cancellation and recovery | m4-events-lifecycle | planned | Deterministic recovery tests, Windows lifecycle test |
| 5 | Provider onboarding through Jcode | m5-provider-onboarding | planned | Provider research accepted, credential hygiene review |
| 6 | Ruflo advanced orchestration | m6-ruflo-orchestration | planned | Optional Ruflo integration review |
| 7 | Soup skill routing (future) | m7-soup-routing | future | Blocked until milestones 1-6 pass |
| 8 | OmniRoute provider routing (future) | m8-omni-route | future | Blocked until milestones 1-6 pass |

## Dependency order

```text
Stage Zero
  -> Milestone One
  -> Milestone Two
  -> Milestone Three
  -> Milestone Four
  -> Milestone Five
  -> Milestone Six
```

Future Milestone Seven and Future Milestone Eight depend on Milestone Six and
are blocked until all six backend milestones pass. No future milestone starts
early.

## Stage Zero gates

- Materialize: mission documents, research evidence, machine files and schemas.
- Validate: deterministic validator, validator mutation tests, `validate:mission`
  command and Windows CI integration.
- Freeze: SHA-256 manifest, independent review, open Draft PR to `main`.

## Backend milestone gates

Every backend milestone stage has an n8n research gate. A stage that changes the
user-facing product UI must record a Taste decision. Every security-sensitive
requirement is mapped to at least one threat. Every requirement maps to
acceptance criteria, non-goals, planned implementation files, planned tests,
evidence, commit and CI run.

## Stage Zero record

Repository: `yousefghorbanian98-create/Coding-Studio`
Branch: `arena/01a06b4c-coding-studio`
Base commit: `710324911da56856ae6a67bdb2f24bbfe3031b87`

Stage Zero changes no production runtime behavior, does not integrate any
provider or orchestrator, and does not begin Milestone One.
