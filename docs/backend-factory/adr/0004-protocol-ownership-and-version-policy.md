# ADR-0004: Protocol ownership and version policy

Status: accepted · Milestone One · 2026-09-05

## Decision

The compatibility boundary is **owned by Coding Studio** in
`src-tauri/src/jcode/`. No upstream internal struct crosses this boundary (nor
the future Tauri IPC boundary in Milestone Three). The module defines its own:

- wire shapes (serde, tolerant of unknown fields, strict on required ones),
- normalized event enum (CS vocabulary),
- identifier newtypes (validated, redaction-safe),
- stable CS error codes (`JCODE-Exxxx`, stable across releases),
- tri-state capability negotiation: `supported | unsupported | unknown`,
  deny-by-default — unknown is never promoted to supported.

Version policy:

- Pin block: ADR-0002. Classification: exact pin → supported; lower semver →
  unsupported-older (fail closed); higher semver → unknown-newer (fail
  closed); malformed report → fail closed.
- Protocol major: only `1` accepted. A `hello` range not covering major 1
  receives/expects `unsupported_version` and the channel closes.
- Additive upstream minors are tolerated (unknown kinds skipped with bounded
  diagnostics). Breaking upstream majors require a new gate pass and a pin
  bump — mirroring Hermes Agent's observed "time-boxed compatibility with
  staged disable" philosophy (reference-only; see OSS register): compatibility
  is explicit, dated, test-locked, and ends deliberately rather than silently.

## Consequences

- Upstream internal refactors cannot break Coding Studio silently: only the
  curated harness surface and its schema-snapshot-locked wire shapes are
  consumed, and any drift fails CI fixtures before it can confuse a user.
