# Milestone One — Taste Decision

- **No user-facing visual redesign.** This milestone changes no product UI:
  no component, style, route, copy, or interaction in `src/` was added,
  removed, or altered. `stages.json` records `changesUserFacingUi: false` for
  `m1-jcode-compat`.
- **Architecture and security decisions are outside Taste scope.** Protocol
  selection, version pinning, and the redaction boundary are engineering
  decisions recorded in ADRs.
- **No new user-facing control.** Nothing in this milestone adds a button,
  dialog, menu, setting, or status surface.
- **Committed diagram uses the Coding Studio visual language.**
  `m1-architecture.svg` is a self-contained static SVG using the product
  tokens from `src/styles/globals.css` (`--color-canvas`, `--color-surface`,
  `--color-surface-2`, `--color-line`, `--color-ink`, `--color-ink-soft`,
  `--color-brand`, `--color-brand-soft`, `--color-ok`, `--color-warn`,
  `--color-danger` — light theme, converted to hex for portability) and the
  product font stacks with system fallbacks.
- **Diagram Design** (`cathrynlavery/diagram-design`, MIT, inspected commit
  `4451eadc484d76aa860edf3289c16fcd082dcdbf`) was used as a
  **development-only reference** for boundary/edge conventions (dashed,
  labeled trust crossings; static-by-default output). It is not a runtime or
  build dependency (ADR-008). The diagram is hand-authored for this
  repository; no asset was copied.
