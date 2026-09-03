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

### One writer for assistant text

`applyRuntimeEvent` in `chat.ts` is the **sole** writer of assistant message
text, keyed by `activeRun`. There is deliberately no second message-generation
path: an earlier build kept a parallel transport layer whose canned prose was
what actually reached the screen, while the bridge's `message.delta` events were
computed and discarded. That layer and a dormant mock generator were both
deleted. `src/stores/__tests__/transcriptProjection.test.ts` guards the rule at
the store level and fails if any source file imports a transport module;
`src/components/__tests__/runtimeTranscript.test.tsx` guards it end to end by
asserting the text on screen came from the runtime.

To keep the graph acyclic, `run.ts` does not import `chat.ts`. It owns a
module-level projection callback and exports `setChatProjection`, which `chat.ts`
calls at module scope. `connectRunStore()` subscribes once via
`subscribeValidated` and fans each event out to the run store and that callback.

## Run lifecycle

`RunPhase` (`src/stores/run.ts`) has eight states:

```
idle ──beginRun──▶ starting ──run.started──▶ streaming ──run.completed──▶ completed
                                   │  ▲                                        
                    approval.requested │  │ approval.resolved                       
                                   ▼  │                                        
                          awaiting-approval                                    
                                                                               
   streaming / awaiting-approval ──cancelRun──▶ cancelling ──run.cancelled──▶ cancelled
   any active phase ──run.failed──▶ failed
```

| Phase | Meaning | Leaves via |
| --- | --- | --- |
| `idle` | No run in flight; the composer is enabled. | `beginRun()` |
| `starting` | Request sent, the runtime has not acknowledged yet. | `run.started`, `run.failed` |
| `streaming` | Deltas are arriving and the transcript is growing. | `run.completed`, `run.cancelled`, `run.failed`, `approval.requested` |
| `awaiting-approval` | Blocked on a human decision in the Approval Center. | `approval.resolved` → back to `streaming`; or cancel/fail |
| `cancelling` | The user asked to stop; the runtime has not confirmed. | `run.cancelled` |
| `cancelled` | Stopped by the user. Partial text is kept; later deltas are ignored. | `beginRun()` |
| `completed` | Finished normally. | `beginRun()` |
| `failed` | The runtime reported a `RuntimeErrorKind`; `chat.ts` maps it to `runtime.errors.<kind>`. | `beginRun()` |

Two rules are enforced in code and pinned by tests:

- **Terminal phases are sticky.** Once `cancelled` or `failed`, a late
  `run.completed` is ignored, and a delta arriving after cancellation cannot
  reappend to the message.
- **Events are session-scoped.** Any event carrying a `sessionId` that does not
  match the active run's is dropped. Session-scoped events without a `runId`
  (notably `context.updated`) previously bypassed the run-id guard, which is
  finding R-1.

The mission brief named an `interrupted` state. It is not implemented as a
distinct phase: user-initiated stops resolve to `cancelling` → `cancelled`, and
runtime-side aborts resolve to `failed` with a typed error kind. Adding a ninth
phase would duplicate those two without changing what the UI shows.

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
