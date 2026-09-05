# ADR-0002: Pinned Jcode version and architecture support

Status: accepted · Milestone One · 2026-09-05

## Decision

Coding Studio supports exactly one verified Jcode release:

- version `0.81.7`, tag `v0.81.7` (annotated),
  commit `358226c2a35b8b50d4d520b3363b0dc60c000fdb`, published
  2026-09-04T21:38:18Z.

Target machine: Windows 11, **x86_64 first** (`windows-x86_64` assets;
`x86_64-pc-windows-msvc`), with **ARM64 recorded as officially supported**
(`windows-aarch64`; built natively on `windows-11-arm` with automated install
checks upstream) but without a live Coding Studio ARM64 probe in this
milestone (bounded follow-up, see `security-review.md` M-4).

Any other version — older, newer, or unparseable — is **unsupported until it
passes every gate again** (provenance, license, release integrity, protocol
stability, Windows assets, compatibility). Unsupported versions fail closed
with an actionable error naming the pinned version. Newer versions are never
assumed compatible.

## Consequences

- `src-tauri/src/jcode/version.rs` holds the single pin block
  (`PINNED_JCODE_*` constants) + classification, covered by unit tests.
- Integrity: tag-immutable `SHA256SUMS` + SHA-256 verification before any
  execution; the byte-exact official checksum set for v0.81.7 is preserved as
  a test fixture (provenance proven against the GitHub API digest).
- Release-upgrade procedure: re-run the full gate set, bump the pin block,
  extend fixtures, re-verify on Windows CI.

Evidence: `../evidence/milestone-one/release-and-license.md`.
