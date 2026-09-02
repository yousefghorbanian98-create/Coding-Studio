# Coding Studio

> AI pair-programming desktop workspace — **Sprint 1: Application Shell + Chat Mock**

A Tauri 2 desktop app with a React 19 frontend. This first milestone delivers the full
workbench shell and a fully interactive chat experience backed by mock data and a
simulated token stream.

---

## Architecture

| Layer | Technology |
| --- | --- |
| Desktop shell | Tauri 2 (Rust) |
| UI | React 19 + TypeScript (`strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`) |
| Bundler | Vite 6 |
| Styling | Tailwind CSS 4 (CSS-first `@theme`, logical properties) |
| Components | Base UI (`Dialog`, `Select`, `Tooltip`, `DirectionProvider`) |
| Animation | Motion |
| Routing | TanStack Router (memory history — desktop app) |
| Server state | TanStack Query |
| Client state | Zustand (+ `persist` for appearance) |
| i18n | i18next / react-i18next — **English + فارسی**, **LTR + RTL** |
| Theming | Dark / Light / System |
| Testing | Vitest + Testing Library (unit/integration), Playwright (e2e) |

---

## Sprint 1 feature checklist

| # | Feature | Where |
| --- | --- | --- |
| 1 | Custom Windows title bar | `src/components/shell/TitleBar.tsx` + `useWindowControls` |
| 2 | Activity rail | `src/components/shell/ActivityRail.tsx` |
| 3 | Resizable sidebar | `src/components/shell/Sidebar.tsx` + `ResizeHandle.tsx` |
| 4 | Main chat area | `src/components/chat/ChatArea.tsx` |
| 5 | Optional inspector panel | `src/components/inspector/Inspector.tsx` |
| 6 | Status bar | `src/components/shell/StatusBar.tsx` |
| 7 | Session list | `src/components/sessions/SessionList.tsx` |
| 8 | Model selector (mock data) | `src/components/chat/ModelSelector.tsx`, `src/mocks/models.ts` |
| 9 | Chat messages (mock data) | `src/mocks/sessions.ts` |
| 10 | Experimental streaming | `src/mocks/stream.ts` (abortable, token-by-token) |
| 11 | Send & Stop | `src/components/chat/Composer.tsx` |
| 12 | Command palette | `src/components/palette/` |
| 13 | Keyboard shortcuts | `src/hooks/useKeyboardShortcuts.ts` |
| 14 | Persisted appearance settings | `src/stores/preferences.ts` (localStorage) |
| 15 | Vitest & Playwright | `src/**/__tests__`, `e2e/` |

---

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Command palette | `Ctrl/⌘ + K` |
| New session | `Ctrl/⌘ + N` |
| Toggle sidebar | `Ctrl/⌘ + B` |
| Toggle inspector | `Ctrl/⌘ + I` |
| Toggle theme | `Ctrl/⌘ + J` |
| Switch language | `Ctrl/⌘ + Shift + L` |
| Focus composer | `Ctrl/⌘ + /` |
| Stop streaming | `Esc` |
| Shortcuts help | `?` |

Composer: `Enter` sends, `Shift + Enter` inserts a newline.

---

## Project layout

```
src/
  app/            Providers (Query, Direction) + TanStack Router
  components/
    chat/         ChatArea, Composer, ModelSelector, MessageItem, MessageContent
    inspector/    Optional right-hand metadata panel
    palette/      Command palette + command registry
    sessions/     Session list
    settings/     Appearance + shortcuts dialogs
    shell/        TitleBar, ActivityRail, Sidebar, ResizeHandle, StatusBar, AppShell
    ui/           Icon, IconButton, Kbd primitives
  hooks/          useAppearance, useKeyboardShortcuts, useWindowControls
  i18n/           i18next setup + en/fa bundles (type-checked for key parity)
  lib/            cn, format, env helpers
  mocks/          models, sessions, abortable stream simulator
  stores/         Zustand: chat, preferences (persisted), ui
  styles/         Tailwind 4 theme tokens (light + dark)
src-tauri/        Rust crate, tauri.conf.json, capabilities
e2e/              Playwright specs
```

---

## Getting started

```bash
npm install

npm run dev        # Vite dev server on http://localhost:1420
npm run build      # tsc -b && vite build
npm run typecheck  # app + e2e type checking
npm test           # Vitest (54 tests)
npm run test:e2e   # Playwright (requires: npm run test:e2e:install)

npm run tauri dev    # native desktop window (requires Rust toolchain)
npm run tauri build  # production desktop bundle
```

### Requirements for the native shell

`npm run tauri dev` needs a Rust toolchain (`rustup`) plus the platform WebView
dependencies. The web frontend runs standalone in any browser — `useWindowControls`
detects the absence of Tauri and hides the native window buttons, so the shell is
fully usable in a browser preview.

---

## Testing

**Unit & integration (Vitest + Testing Library, jsdom) — 54 tests**

- `src/stores/__tests__/` — chat store (streaming, stop, sessions, models) and
  persisted preferences (clamping, theme, language, localStorage).
- `src/mocks/__tests__/` — the abortable stream simulator and model catalogue.
- `src/i18n/__tests__/` — en/fa key-set parity and direction mapping.
- `src/lib/__tests__/` — `cn` and Intl formatting helpers.
- `src/components/shell/__tests__/` — shell regions, sidebar/inspector toggles,
  RTL switching, theme class, accessible resize separator.
- `src/components/chat/__tests__/` — transcript, filtering, send/stop, Enter vs
  Shift+Enter, markdown-ish block parser.
- `src/components/palette/__tests__/` — palette filtering, running commands, empty state.

**End-to-end (Playwright, Chromium)** — `e2e/shell.spec.ts`, `e2e/chat.spec.ts`,
`e2e/palette.spec.ts` cover the shell regions, drag-resizing the sidebar, the full
send → stream → stop loop, model switching, the command palette and appearance
persistence across reloads. Run `npm run test:e2e:install` once to fetch Chromium.

---

## Internationalisation & RTL

- The active language drives `<html lang>` and `<html dir>`; Base UI receives the
  same value through `DirectionProvider`.
- Styling uses **logical properties** (`ms-*`, `pe-*`, `border-s`, `start-*`) so a
  single stylesheet serves both directions. Only directional glyphs (the send
  arrow) are mirrored with `rtl:-scale-x-100`.
- Code blocks and identifiers are pinned to `dir="ltr"` so snippets stay readable
  inside Persian text.
- A unit test enforces that the Persian bundle has exactly the same key set as
  English, so a missing translation fails CI rather than falling back silently.

---

## Notes on the mock layer

`src/mocks/stream.ts` simulates an LLM: it picks a deterministic reply, splits it
into word-level chunks and emits them on a timer that honours an `AbortSignal`.
The per-chunk delay varies with the selected model's badge (`fast` / `balanced` /
`reasoning`), which makes the Stop button meaningful. Swapping this module for a
real transport is the natural entry point for Sprint 2.
