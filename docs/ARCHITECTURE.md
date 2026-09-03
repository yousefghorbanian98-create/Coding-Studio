# Frontend Architecture

How the UI is put together, and where the seam sits that a real runtime will
eventually plug into. Everything below describes the build as it exists: the
runtime is a deterministic in-process mock, and no provider is connected.

## The one contract: StudioRuntimeBridge

`src/services/runtime/types.ts` defines the single interface the UI depends on.
Nothing in `src/components` or `src/stores` knows whether the thing behind it is
a mock, a Tauri IPC channel, or a Rust supervisor driving Jcode.

```
Today:   React UI → StudioRuntimeBridge → MockStudioRuntime
Target:  React UI → StudioRuntimeBridge → Tauri IPC → Rust supervisor → Jcode → providers
```

The bridge exposes health, capabilities, providers, models, sessions, runs,
cancellation and approvals. Keeping it this narrow is what makes the swap
tractable later: a real implementation has to satisfy this interface and nothing
else has to change.

`src/services/runtime/index.ts` owns the singleton (`getRuntime()`,
`resetRuntime()`). Components never construct a runtime themselves.

## Event model

The bridge emits a 28-member discriminated union of events, covering run
lifecycle, streamed text, plans, tasks, tool calls, agents, file changes,
approvals, diagnostics and errors.

Two rules matter:

1. **Every inbound event is validated with Zod** (`schemas.ts`) before it
   reaches any store. A malformed payload is dropped and recorded as a
   diagnostic rather than thrown — a buggy runtime must not be able to crash the
   UI. The `invalid-event` scenario exercises exactly this path.
2. **Events are applied by one reducer.** `useRunStore.apply()` is the only
   place that interprets them, so there is a single answer to "what does this
   event do to the UI".

## State ownership

Each store owns one thing, and they do not overlap:

| Store              | Owns                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| `run.ts`           | The **live run**: phase, streamed text, plan, tasks, tool calls, agents, changes, approvals, error, token usage. Cleared per run. |
| `chat.ts`          | **Durable conversation**: sessions, messages, active session. Persisted. |
| `runtime.ts`       | Connection state, selected provider/model/mode.                       |
| `permissions.ts`   | Approval policy per operation kind. Persisted.                        |
| `preferences.ts`   | Theme, language, layout. Persisted.                                   |
| `ui.ts`            | Ephemeral view state: open panels, dialogs, active tab.               |

The split between `run` and `chat` is deliberate: run state is disposable and
rebuilt from events, chat state must survive a reload. `connectRunStore()` wires
the run store to the bridge's event stream once, at startup.

One consequence worth remembering: the composer must drive **both** — it appends
to `chat` and calls `getRuntime().sendMessage()`. A regression where it only did
the former left every agent surface silently empty, which is why
`src/stores/__tests__/composerRuntimeWiring.test.ts` exists.

## Component boundaries

```
components/
  shell/      AppShell, TitleBar, ActivityRail, Sidebar, StatusBar — layout and landmarks
  chat/       ChatArea, Composer, MessageItem/Content — the conversation column
  agent/      PlanCard, ToolTimeline, ApprovalCard, AgentRoster — run surfaces
  workspace/  Explorer, SearchPanel, DiffViewer — the code side
  panel/      BottomPanel — terminal, problems, output, agent logs
  settings/   SettingsDialog and its panels
  palette/    CommandPalette
  ui/         Icon, IconButton, Kbd — the primitives
  devtools/   ScenarioLab — development only
```

Agent surfaces are self-selecting: each reads the run store and renders `null`
when it has nothing to show, so `ChatArea` does not need to know which scenario
is running. `AgentRoster` hides itself when no agent has reported; `PlanCard`
when there is no plan.

## Persistence

Only three things are stored, all in `localStorage`, all namespaced
`coding-studio:*`:

- **Sessions** (`services/sessionStorage.ts`) — versioned with
  `SESSIONS_SCHEMA_VERSION` and validated on read. A half-streamed message is
  never persisted as still streaming, so a crash mid-response cannot restore a
  session stuck in a spinner. Unreadable data is discarded rather than allowed
  to wedge startup.
- **Permissions** — the approval policy map.
- **Preferences** — theme, language, layout.

No credentials, tokens or provider secrets are stored, and there is nothing to
store: no provider is connected.

## Mock scenarios

`src/services/runtime/scenarios.ts` defines 30 scenarios across six groups
(baseline, plans, approvals, tools, errors, agents). They are deterministic —
driven by an injectable clock, not wall time — which is what makes screenshot
tests and Playwright runs stable.

Select one with `?scenario=<id>`, or from the Scenario Lab in development.
Several behaviours look like bugs but are deliberate: approval scenarios park on
`approval.requested` until answered, `runtime-unavailable` rejects at the health
check with zero events, and `cancel-during-tool` only emits `run.cancelled` if a
cancel arrives mid-flight.

## Security boundaries

- **No network egress from the frontend.** Nothing calls a provider, and there
  is no local model daemon — Ollama was removed entirely.
- **CSP** (`src-tauri/tauri.conf.json`) is restricted to `'self'` plus the Tauri
  IPC and asset origins. No remote script or style origin is allowed.
- **Tauri capabilities** are allowlisted per window rather than opened globally.
- **Approvals are enforced in the UI layer** for now: destructive operations
  (shell commands, file modification, package installation) surface an approval
  request the user must answer. When a real runtime exists this must be enforced
  on the Rust side as well — a UI-side check is a usability feature, not a
  security boundary, and should not be mistaken for one.
- **No telemetry, no cloud sync, no auto-update keys, no signing keys.**
