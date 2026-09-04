# Backend Architecture

## Target architecture

```text
+---------------------- React UI -----------------------+
|  Typed StudioRuntimeBridge (types.ts)                  |
|  Provider-neutral commands and 28-event union          |
+---------------------- Tauri IPC -----------------------+
|  typed Rust request/response payloads                  |
|  stable error codes, Rust-side + TypeScript-side valid |
|  bounded event queues, listener cleanup, StrictMode    |
+---------------------- Rust Process Supervisor ---------+
|  explicit executable path, pinned version              |
|  safe spawn (no shell, arg separation, env allowlist)  |
|  validated working dir, canonical paths, junction guard|
|  bounded stdout/stderr, backpressure, timeout          |
|  graceful cancel -> forced terminate -> process tree    |
|  crash detection, orphan cleanup, restart policy       |
+---------------------- Jcode ----------------------------+
|  machine protocol: structured output, events           |
|  headless: session, resume, streaming, cancel, approve |
+---------------------- AI providers ---------------------+
|  Claude | OpenAI/Codex | Gemini | GitHub Copilot        |
+---------------------------------------------------------+
```

## Component boundaries

- **React UI.** Talks only to `Typed StudioRuntimeBridge`. No provider runtime
  implementation, no credential handling, no direct process control.
- **Tauri IPC.** Provider-neutral commands exposing health, capabilities,
  providers, models, sessions, runs, cancellation, approvals and diagnostics.
  Runtime payloads are validated on both sides; errors are coded and never
  panic across IPC.
- **Rust Process Supervisor.** Owns Jcode discovery, install, spawn, streaming,
  cancellation, crash detection and diagnostics. It never interpolates arguments
  into a shell and never mutates PATH without explicit consent.
- **Jcode.** The supported core coding runtime. It is executed only through the
  documented machine protocol and only after Milestone One freezes that protocol.
- **Providers.** All provider network and authentication behavior goes through
  Jcode. Coding Studio does not create an independent duplicate provider client.

## Mock and real runtime selection

- `MockStudioRuntime` remains the browser preview runtime.
- `RealJcodeRuntime` is selected only when a validated Jcode installation is
  present and the machine protocol is supported.
- CI and browser preview do not depend on a real Jcode installation.

## Event and recovery model

- Jcode events are normalized into a versioned schema with ordering, sequence
  numbers, deduplication and session/run/task/tool/approval correlation.
- Malformed, unknown, partial and duplicate events are classified safely.
- Sessions are resumable; partial responses are preserved.
- Approvals and permissions are enforced in the backend with safe defaults.
- Stale and duplicate approval resolutions are rejected.
- A recovery state machine covers application shutdown, Jcode crash, Coding
  Studio restart and runtime restart without discarding uncommitted user changes.

## Ruflo (optional)

Ruflo is an optional advanced orchestrator behind a feature flag. It supports
agent roles, task graphs, shared memory, swarm lifecycle, concurrency limits,
cancellation, partial failure recovery, cost and resource controls, audit trail
and an approval boundary. Ordinary Jcode mode works without Ruflo. Ruflo failure
never blocks ordinary Jcode mode. Default limits are suitable for 16 GiB systems.

## Security boundaries

- Secrets never reach React, localStorage, Tauri events, diagnostics or CI logs.
- No credentials committed to Git.
- No remote script piped into a shell.
- No mutable latest releases, unpinned actions, unattributed copied code or
  incompatible licenses.
- Process spawning is shell-free; working-directory and canonical path
  validation protects against symbolic-link and junction escape.
- Merge, real OAuth, purchases, secrets and releases remain human-controlled.

## Taste boundary

Taste Skill supervises user-facing changes only. It does not control backend
architecture or security. Recommendations conflicting with accessibility,
performance, the existing design system or the target hardware are rejected.

## Ollama

Ollama is removed completely and is never restored. No code path contacts a
local model daemon.
