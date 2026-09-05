# Provider Plan

## Providers

- Claude
- OpenAI / Codex
- Gemini
- GitHub Copilot

## Provider order research

Provider order must be researched rather than assumed. The first provider is
selected based on **Jcode protocol stability**, **testability** and
**authentication support**. Because Jcode is not yet implemented and the
protocol is not yet frozen, the selection is gated by Milestone One evidence.

Selection gate (Milestone Five):

1. Inspect the frozen Jcode machine protocol evidence from Milestone One.
2. Score each candidate provider on protocol stability, testability and
   supported authentication mode.
3. Prefer the provider with the most stable machine-readable events, the most
   deterministic headless test harness and the simplest officially supported
   authentication handoff.
4. Record the decision in an ADR.
5. Enable one provider at a time with fake-provider tests first.

Provisional candidates (not a final decision):

| Provider | Protocol stability | Testability | Authentication |
| --- | --- | --- | --- |
| Claude | Scored at M1 | Scored at M1 | Browser and device-code handoff |
| OpenAI / Codex | Scored at M1 | Scored at M1 | Token and device-code handoff |
| Gemini | Scored at M1 | Scored at M1 | Browser and device-code handoff |
| GitHub Copilot | Scored at M1 | Scored at M1 | Browser and token handoff |

The table is a research input, not an approval. No provider is enabled before
the selection evidence is reviewed.

## Authentication modes

Support the officially supported authentication mode, browser authentication
handoff, device-code handoff and headless authentication. Handle authentication
success, cancellation, expiry and failure. Handle logout handoff and unavailable
provider without stale credentials.

## Credential hygiene

- no raw token in React
- no credentials in localStorage
- no credentials in Tauri events
- no credentials in diagnostic logs
- no credentials in CI
- no independent duplicate provider client when Jcode already supports it

## Release gate

Real Windows validation is documented as a manual release gate. Local browser or
mock evidence is never claimed as real Windows provider validation.
