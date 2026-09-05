# ADR-0008: Diagnostics and redaction boundary

Status: accepted · Milestone One · 2026-09-05

## Decision

Channels are strictly separated, and display of dynamic content is
redaction-first.

- **Channel discipline:** protocol frames = stdout/socket only; operator
  diagnostics = stderr only (captured, bounded, never parsed as events);
  terminal control bytes never leave the `TerminalControl` diagnostic class.
- **Redaction:** before any dynamic string from the protocol or a child
  process is displayed, logged, or stored as diagnostics, it passes
  `auth::redact` — masking API-key shapes (`sk-…`, `ghp_…`, `gho_…`,
  `xox[bap]-…`, `AIza…`, `AKIA…`), bearer tokens, JWTs (`eyJ…`),
  `Authorization`/cookie/`key`/`token` key-value forms, and PEM private-key
  blocks — then length-capped (with an explicit `[truncated]` marker).
- **Unknown event kinds** survive only as a bounded, redacted kind name
  (`Unknown { kind }`), never the raw payload.
- **Debug/Display** implementations on all boundary types call the redactor;
  identifier newtypes print as short values with an ellipsis when truncated.
- Coding Studio never logs/stores tokens, cookies, authorization headers,
  environment secrets, prompts containing secrets, or complete provider
  responses; transcript bodies are data, not logs.

## Consequences

- Tests assert: redaction of each secret shape, length caps, that
  `format!("{:?}")` of every event type routes through the redactor, and that
  a fixture stream carrying embedded synthetic secrets produces diagnostic
  strings with no residue.
- Known limit (Medium, justified `security-review.md` M-2): pattern-based
  redaction is defense-in-depth, not a mathematical guarantee; complete
  provider responses are never logged by design, so the residual risk is
  user-pasted secrets inside tool output previews, which are additionally
  length-capped.
