# ADR-0003: Selected machine protocol — jcode harness API (NDJSON, major v1)

Status: accepted · Milestone One · 2026-09-05

## Decision

The machine protocol is the official **harness API** exposed by the official
binary's `jcode api-bridge` subcommand: newline-delimited JSON frames over the
platform-local transport (Unix socket; Windows named pipe
`\\.\pipe\<stem>-<sha256(path)[..16]>`), envelope `{v, id, req…}` for requests
and `{v, reply_to?, ev…}` for events, protocol major `1`, additive minor `0`,
with a `hello` min/max version handshake as the mandatory first frame.

Selected under the mission's option 1 (official stable machine interface with
versioned types). Source evidence and the full answers to the thirteen gate
questions: `../evidence/milestone-one/protocol-selection.md`.

## Why not the alternatives

- Internal `jcode-protocol` (legacy daemon socket): explicitly the *private*
  surface; larger, churns freely. Rejected.
- Upstream crates as dependencies: `jcode-sdk` is `publish = false` with
  path-only deps (not on crates.io); vendoring is forbidden by policy.
  Rejected — the wire shape is implemented independently in
  `src-tauri/src/jcode/protocol.rs`.
- `jcode run --ndjson`: documented headless mode, retained as secondary
  vocabulary evidence; lacks sessions/attach/approvals. Rejected as the
  primary surface.
- TUI: would have blocked the milestone. Not the case.

## Consequences

- Milestone Two launches `jcode serve` + `jcode api-bridge` from the
  integrity-verified install and connects through the harness socket/pipe.
- Coding Studio tolerates additive upstream events (unknown kinds are skipped
  with bounded redacted diagnostics) and fails closed on a major-version
  mismatch.
