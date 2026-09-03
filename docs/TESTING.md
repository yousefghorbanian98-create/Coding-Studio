# Testing

No test in this repository contacts a real AI provider, and none can: no
provider is connected and the frontend performs no network egress. Everything is
driven by the deterministic mock runtime.

## Running the suites

```bash
npm run lint         # ESLint
npm run typecheck    # app and e2e TypeScript projects
npm test             # Vitest — unit and component
npm run test:e2e     # Playwright
npm run build        # production bundle
```

Playwright browsers cannot be installed in every sandbox; the e2e and screenshot
suites are authoritative on Windows CI.

## Unit tests

Pure logic, no DOM. Covers `src/lib` (fuzzy matching, markdown parsing,
formatting, platform detection), the runtime schemas and fixtures, and the
session storage codec including its version-migration and corrupt-data paths.

The runtime suites are the largest: `allScenarios.test.ts` drives all 30
scenarios through the bridge and asserts each one's event sequence, using an
injectable clock so nothing depends on wall time.

## Component tests

Vitest + Testing Library, rendered through `src/test/render.tsx`
(`renderWithProviders`) so i18n, theme and query client are always present.

Spread across 36 files, notably:

- **Stores** (8 files) — reducers for all 28 events, session lifecycle,
  permissions, preferences, and `composerRuntimeWiring.test.ts`, which pins that
  sending a message actually drives the bridge. That test exists because a
  regression once left every agent surface silently empty.
- **`accessibility.test.tsx`** — landmarks, accessible names on every button and
  textbox, no-colour-alone for diffs, problem severity and status dots, dialog
  semantics and Escape, single tab stop in the panel tablist, and a cap of two
  live regions in the resting shell.
- **`visualPolish.test.tsx`** — the invariants that are cheap to break and hard
  to see: long unbroken strings must wrap, code blocks must scroll rather than
  stretch, truncated text must carry a tooltip, empty states must guide.

## Playwright

Eleven specs under `e2e/`: shell, chat, agent surfaces, approvals, workspace,
sessions, persistence, settings, palette, keyboard and scaling.

Recipes that keep them stable:

- Boot a known state with `page.goto('/?scenario=<id>')`, then wait for
  `app-shell`.
- Streaming assertions need `{ timeout: 30_000 }`.
- An `aria-disabled` element is **not** actionable — a plain `.click()` hangs for
  the full timeout. Assert inertness with `click({ force: true })` followed by a
  "nothing changed" expectation.
- Use `toBeHidden()` for absent nodes.
- Console sweeps expect an empty error list.

## Screenshots

`e2e/screenshots.spec.ts` produces the 12 mandatory shots plus supporting
reference shots. Each freezes motion and waits for `networkidle` first, so the
images are byte-stable across runs.

Wait for the surface the chosen scenario actually produces — the multi-agent
scenario emits `agent.*` events and no tool calls, so waiting on a tool timeline
there times out.

## Windows CI

`.github/workflows/ci-windows.yml` runs on `windows-latest`: lint, type-check,
Vitest, production build, Playwright, `cargo test`, `tauri build`. It uploads
three artifacts — the unsigned Windows bundle, the Playwright HTML report, and
the UI screenshots. No signing or auto-update keys are configured or committed.

CI job logs are not always retrievable through the API; failures are also posted
as a PR comment, which is the reliable channel for reading them.

## Manual QA checklist

Run against `npm run dev`, or the packaged build for the last three items.

**Conversation**
- [ ] Send a message; the reply streams and the caret disappears on completion.
- [ ] Stop mid-stream; the partial reply is kept and the run reports cancelled.
- [ ] Reload; sessions and the active session survive, with no message stuck streaming.

**Agent surfaces**
- [ ] `?scenario=plan-awaiting-approval` shows a plan with per-step status.
- [ ] `?scenario=shell-approval` blocks until answered; reject stops the run.
- [ ] `?scenario=multi-agent` lists the agent roster with text statuses.
- [ ] `?scenario=runtime-unavailable` shows the connection banner, not a crash.
- [ ] `?scenario=invalid-event` degrades to a diagnostic; the UI stays usable.

**Workspace**
- [ ] Explorer expands, collapses and keyboard-navigates with arrow keys.
- [ ] Search shows matches; long paths truncate with a tooltip.
- [ ] Diff shows added and removed lines distinguishable without colour.

**Shell and input**
- [ ] `Ctrl+K` opens the palette; a disabled command explains itself.
- [ ] Every interactive element is reachable by Tab with a visible focus ring.
- [ ] Settings opens, closes on Escape, and returns focus to its trigger.

**Presentation**
- [ ] Light and dark themes both legible.
- [ ] English and Persian both render, Persian right-to-left.
- [ ] Enable OS "reduce motion": animations stop, including JS-driven ones.
- [ ] Resize narrow and wide; no horizontal scrollbar appears.

**Packaged build (Windows)**
- [ ] Custom title bar minimises, maximises and closes.
- [ ] High-DPI display renders crisply at 125% and 150% scaling.
- [ ] No devtools-only surface (Scenario Lab) is visible in the release build.

## Test-environment gotchas

Recorded because each one cost real debugging time and none is obvious:

- **`userEvent.setup()` installs its own clipboard stub.** A `navigator.clipboard`
  spy must be planted *after* `setup()`, or it is silently overwritten and the
  assertion fails for a reason unrelated to the code under test.
- **`navigator.clipboard` is getter-only in jsdom** — use `Object.defineProperty`
  with `configurable: true`, not `Object.assign`.
- **jsdom has no layout**, so a full-screen backdrop is reported as the hit
  target for everything beneath it and `userEvent.click` refuses the click.
  `fireEvent.click` is the right tool for those cases.
- **A document-level `click` listener fires before React's synthetic click.**
  Closing a popover that way tears it down before the chosen item's own handler
  runs; use a backdrop element instead.
- **`vi.fn(() => Promise.resolve())` infers a zero-argument signature**, so
  `mock.calls[0][0]` is a type error. Declare the parameter explicitly.
