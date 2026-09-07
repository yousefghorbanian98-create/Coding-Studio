# Milestone Two Taste Decision

## Reference

- Repository: https://github.com/Leonxlnx/taste-skill
- Inspected commit: `ccbc15639c97057cbfcf32ecebc38ef716e4bb37`
- License: MIT
- Scope: Quality governance for Milestone Two

## Decision

### No user-facing UI change in Milestone Two

Milestone Two implements managed Jcode installation and a Windows process
supervisor. These are backend-only capabilities. No frontend component,
no Tauri IPC surface, and no visual change is introduced.

### No frontend redesign

Milestone Two does not touch any frontend file. The existing UI remains
unchanged. Any future UI integration of installation progress or
supervisor status belongs to Milestone Three.

### Quality supervision applies to backend surfaces only

Taste governance in Milestone Two applies to:

- **API naming:** Function and type names must be clear, consistent, and
  self-documenting. Use `ManagedInstaller`, `ProcessSupervisor`,
  `BoundedStream` rather than abbreviations or generic names.
- **Error clarity:** Error types must carry context (source, kind, cause)
  and produce human-readable messages. Use `thiserror` and typed enums.
- **Lifecycle predictability:** Installation and supervisor state machines
  must have explicit, documented transitions. No hidden state changes.
- **Module cohesion:** Each module has a single responsibility. Installer,
  supervisor, and protocol decoder are separate modules.
- **Reviewability:** Code must be readable by an independent reviewer.
  Functions under 100 lines, clear control flow, explicit error handling.
- **Minimal configuration:** Default to safe, secure behavior. Require
  explicit opt-in for advanced features (e.g., custom download URL).

### Taste cannot override architecture or security

Taste governance is subordinate to:

- **Architecture:** The contract-first discipline from Milestone One, the
  provider-neutral boundary, and the mock runtime retention policy.
- **Security:** Threat mitigations documented in `08-THREAT-MODEL.md`,
  the OSS adoption policy in `11-OSS-ADOPTION-POLICY.md`, and the
  provider-exclusion rules (Ollama remains excluded).

If a Taste suggestion conflicts with architecture or security, the
suggestion is rejected and recorded in this document.

### No Taste-driven scope expansion

Taste governance must not expand Milestone Two scope. If a Taste
suggestion requires work beyond the eight in-progress requirements, the
suggestion is deferred to a future milestone.

## Examples of Taste Application

### Good Taste
- Rename `spawn_child` to `spawn_managed_process` for clarity.
- Add `Display` implementation to `InstallError` with context.
- Split `Installer::install` into `download`, `verify`, `promote` methods.
- Document state machine transitions in module-level comments.

### Rejected Taste
- Add a progress bar UI (out of scope, belongs to Milestone Three).
- Redesign error types to use a generic `anyhow::Error` (loses type safety).
- Merge installer and supervisor modules (violates cohesion).
- Add configuration for custom download mirror (scope creep, security risk).

## Conclusion

Taste governance in Milestone Two is limited to backend code quality:
naming, error clarity, lifecycle predictability, module cohesion,
reviewability, and minimal configuration. Taste cannot override
architecture or security, and cannot expand scope.
