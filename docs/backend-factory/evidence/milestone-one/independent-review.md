# Independent review — Milestone One

Run ID: `run-2026-09-05-107b3c58` · Review authority: external human reviewer
(conducted after the Windows CI envelope first went fully green).

## Round outcome

**Verdict: CHANGES REQUESTED (review-and-fix round 1).** The independent review
accepted the overall architecture, the protocol selection, the capability
matrix posture, and the integrity-evidence trail, and requested changes —
no acceptance, no completion claim. Attempt policy respected: this round is a
review-fix round, not another CI self-remediation cycle; the 5/5 CI
remediation history and the approved-exception log remain on record unchanged.

## Findings and remediation status

| # | Finding | Disposition |
|---|---------|-------------|
| R1-1 | Pinned-release identity gate too weak: only semver + optional tag-contradiction were enforced. A report missing `git_tag`/`git_hash` (or with wrong hash, or `release_build` absent/false) could classify `Supported`. | **Fixed.** `version.rs::classify` now requires full identity agreement for `Supported`: semver == 0.81.7; `version` (when present) agrees; `git_tag` == `v0.81.7` (required); `git_hash` == official short `358226c` or full `358226c2a35b8b50d4d520b3363b0dc60c000fdb` (required); `release_build` exactly `true`. Missing/contradictory identity → `Malformed` (fail closed). `build_time`/`git_date` remain non-trusted. Older/newer lanes (`UnsupportedOlder`/`UnknownNewer`) unchanged, including regression coverage proving identity metadata cannot elevate them. |
| R1-2 | Wording claimed GitHub tag/release-asset URLs are immutable. | **Fixed.** All surfaces (version.rs/verification.rs comments, workflow header, ADR-0001/0002, release-and-license.md, oss-register.md, security-review.md, PROVENANCE.md) now state: URLs are version-scoped pointers, not trust anchors; assets/tags can be replaced server-side; the embedded SHA-256 digest is the immutable Coding Studio trust anchor; replacement or tag movement fails the pinned digest check before execution. Pinned release and digests unchanged. The unit test previously named `urls_are_tag_immutable` is renamed `urls_are_version_scoped_not_trust_anchors` with the same assertions. |
| R1-3 | Temporary rustfmt patch-publisher step still present in `ci-windows.yml` (recovery scaffolding past its purpose). | **Fixed.** The patch-publication step and its comment block are removed. Unchanged and enforced: `cargo test`, `cargo fmt --check`, `clippy -D warnings`, the bounded Rust failure excerpt/annotation + PR-comment bridge, `Tauri build`, the artifact uploads, and the isolated `jcode-release-probe` job. Permissions unchanged; no gate weakened or skipped. |
| R1-4 | Review/factory records must reflect reality (review rounds, blockers, no completion claim). | **Done.** This document replaces the preview posture; `reviewAndFixRounds = 1`; the obsolete fmt/clippy blocker is closed; Milestone One stays active; JCODE-001…009 stay in-progress; Milestone Two untouched. |

## Context preserved (for the record)

- The green CI envelope (both Windows events) precedes this review-fix commit:
  mission validator, lint, typecheck, 648 Vitest, Playwright e2e, `cargo test`
  (Rust unit + integration), `cargo fmt --check`, `clippy -D warnings`, Tauri
  build, and the integrity-verified pinned-release probe all passed at
  `49605ac`.
- The identity-gate strengthening (R1-1) is verified by the new focused unit
  tests; classification lanes for older/newer are regression-controlled.

## Status

**Awaiting reviewer re-review of round-1 fixes.** Milestone One is *not*
marked complete or accepted anywhere. No milestone or requirement state was
advanced by this document.
