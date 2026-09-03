# Accessibility & Performance — Slice 14

Scope: the mock-runtime frontend. No real provider, Jcode, Ruflo, Soup or OmniRoute
behaviour is involved; everything described here is about the UI shell.

## Accessibility

### Landmarks

The resting shell exposes exactly one of each page-level landmark:

| Landmark        | Element                              |
| --------------- | ------------------------------------ |
| `banner`        | `TitleBar`                           |
| `main`          | chat/workspace column                |
| `navigation`    | activity bar, session list           |
| `complementary` | side panels                          |
| `contentinfo`   | `StatusBar`                          |

Two duplicate-`banner` defects were found and fixed in this slice. A `<header>` only
stops being a page banner when it is nested in `section`, `article`, `aside`, `nav`
or `main` — and `article` does **not** scope it. So:

- `DiffViewer`'s wrapper became a labelled `<section>` (its header is genuinely the
  header of that region).
- `MessageItem`'s header became a plain `<div>` (it is decorative chrome, not a
  landmark), even though it sits inside an `<article>`.

`src/components/__tests__/accessibility.test.tsx` pins this so a future component
cannot silently add a third banner.

### Not relying on colour alone

Every state that was communicated by colour now also has text or `sr-only` text:

- **Diff lines** — the `+`/`-` glyph is `aria-hidden` and each row carries an
  `sr-only` "added line"/"removed line" label (`changes.line.added` /
  `changes.line.removed`, present in both locales).
- **Problem severity** — each row renders a visible `Error`/`Warning` label.
- **Connection status dot** — always paired with its text status.
- **Plan steps** and **tool cards** — carry an `sr-only` / visible status string.

### Motion

`globals.css` honours `prefers-reduced-motion`, but a CSS media block cannot reach
JS-driven animation. `src/app/Providers.tsx` therefore wraps the tree in
`<MotionConfig reducedMotion="user">` so `motion/react` follows the same OS setting.

### Live regions

The resting shell keeps at most two live regions (status bar, search results) so
announcements do not collide. This is asserted by test.

### Dialogs, focus and keyboard

The settings dialog has an accessible title, a labelled close control, and closes on
Escape. The bottom-panel tablist is a single tab stop with `aria-controls` /
`aria-labelledby` wiring between each tab and its tabpanel. Every button and textbox
in the shell has an accessible name — asserted globally rather than case by case.

## Performance

### Bundle size, before and after

Vendor code was split out of the app chunk. A UI change no longer invalidates the
whole download, and the browser parses the pieces in parallel.

| Chunk       | Before (gzip) | After (gzip) |
| ----------- | ------------- | ------------ |
| app `index` | 271.59 kB     | 215.28 kB    |
| `motion`    | —             | 38.21 kB     |
| `i18n`      | —             | 18.10 kB     |
| `react`     | —             | 1.55 kB      |
| CSS         | 6.25 kB       | 6.25 kB      |

Total shipped bytes are essentially unchanged; what improved is caching and
parallelism. No dependency was added in this slice.

### Lazy syntax highlighting

Not applicable: the project deliberately ships **no** syntax-highlighting library and
no Monaco. Diff and code rendering is plain styled markup, which is why the mission's
"lazy-load the highlighter" item needs no work.

### Leaks

- **Listeners** — every `addEventListener` in product source is matched by a
  `removeEventListener`. One real leak was fixed: `src/mocks/stream.ts` attached an
  `abort` listener per streamed chunk and only detached it on abort, so a full run
  accumulated one listener per word. It now detaches on the happy path too.
- **Timers** — the sleep timer is cleared on abort; the mock runtime's deterministic
  clock is disposed with the run.
- **Idle animation** — the only pulsing elements are the two connection dots, and
  they pulse solely in the `connecting` state, never at idle.

## Verification

`tsc -b`, `tsc -p tsconfig.e2e.json`, ESLint, and the full Vitest suite
(489 tests / 34 files) all pass, plus a clean production build.
