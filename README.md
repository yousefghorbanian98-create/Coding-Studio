# Coding Studio

A desktop AI pair-programming workspace for Windows, built with Tauri, React and
TypeScript.

> **Current status: provider-neutral frontend on a mock runtime.**
> No AI provider is connected. Every agent behaviour — replies, plans, tool
> calls, approvals and multi-agent activity — is produced by a deterministic
> in-process mock. Nothing in this build performs authentication, network calls
> to a model provider, or credential storage.

## Architecture

Today the application stops at the mock runtime:

```
React UI  →  Typed StudioRuntimeBridge  →  MockStudioRuntime
```

The target architecture keeps the same seam and swaps the implementation:

```
React UI  →  Typed StudioRuntimeBridge  →  Tauri IPC
          →  Rust Process Supervisor    →  Jcode
          →  Claude / Codex / Gemini / GitHub Copilot
```

`StudioRuntimeBridge` (`src/services/runtime/types.ts`) is the only contract the
UI depends on. It exposes health, capabilities, providers, models, sessions,
runs, cancellation and approvals, plus a 28-event discriminated union. Every
inbound event is validated with Zod before it reaches the UI: a malformed
payload is dropped and recorded as a diagnostic rather than throwing.

Ollama was removed from the product. No code path contacts a local model daemon.

## Getting started

```bash
npm install
npm run dev          # Vite dev server
npm run tauri dev    # desktop shell (requires the Rust toolchain)
```

## Testing

```bash
npm run lint         # ESLint
npm run typecheck    # app and e2e TypeScript projects
npm test             # Vitest unit and component tests
npm run test:e2e     # Playwright (installs Chromium on first run)
npm run build        # production frontend bundle
```

Tests never contact a real provider. Playwright drives the deterministic mock
through `?scenario=<id>`; the available scenarios are listed in
`src/services/runtime/scenarios.ts`, and in development they can also be picked
from the Scenario Lab in the bottom-right corner.

## Continuous integration

`\.github/workflows/ci-windows.yml` runs on `windows-latest`: lint, type-check,
Vitest, the production build, Playwright, `cargo test`, and `tauri build`. It
uploads three artifacts — the unsigned Windows bundle, the Playwright report and
UI screenshots. No signing or auto-update keys are configured or committed.

## Documentation

- [`docs/mission/MISSION.md`](docs/mission/MISSION.md) — the full mission brief
- [`docs/mission/PROGRESS.md`](docs/mission/PROGRESS.md) — numbered plan and progress
- [`docs/mission/BASELINE.md`](docs/mission/BASELINE.md) — audit taken at mission start

## Roadmap

1. Complete the mock frontend *(in progress)*
2. Jcode managed runtime
3. Claude / Codex / Gemini / Copilot integration
4. Ruflo advanced orchestration
5. Soup skill routing
6. OmniRoute provider routing
7. Security hardening
8. Beta release
