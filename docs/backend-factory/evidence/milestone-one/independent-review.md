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

## Review-fix rounds — full traceability

- **Review-fix round 1** was delivered as commit **`06f8fd5`** ("Milestone One
  review-fix round 1 (external review: CHANGES REQUESTED)"). Its CI exposed a
  **stale-test failure**: `cargo test` failed in both events (runs
  `34014938255`, `34014936519`) because the legacy test
  `parse_version_report_tolerates_missing_optional_fields`
  (`src-tauri/src/jcode/version.rs:462`) still expected `Supported` for a
  report missing `git_hash` and `release_build`, which the strengthened
  identity gate correctly classifies as `Malformed`. 61 of 62 tests passed at
  that commit; the failure was reported without self-remediation.
- **Review-fix round 2** was delivered as commit
  **`f1140403d8d7f222718759c40a7669fc83854750`** ("Milestone One review-fix
  round 2: stale-test correction only"): the stale test was replaced with
  `parse_version_report_tolerates_missing_non_identity_fields`, whose JSON
  carries all four identity fields (`semver 0.81.7`, `git_tag v0.81.7`,
  `git_hash 358226c`, `release_build true`), omits only genuinely
  non-identity optionals, and classifies `Supported`. The production identity
  gate was not touched; all round-1 fail-closed tests were preserved.
- Round-2 CI: **runs `34019189295` (push) and `34019191415` (pull_request)
  both succeeded**, and every required Windows gate was executed and passed —
  frozen-mission validator, Lint, Type-check, Vitest (648), frontend build,
  Playwright E2E, `cargo test` (62 tests), `cargo fmt --check`, clippy with
  `-D warnings`, Tauri build, and the isolated integrity-verified
  pinned-release probe (download, three-way SHA-256 integrity,
  non-authenticated version probe).

## External re-review verdict (round 1 + round 2)

- The **strengthened pinned-release identity gate is accepted**.
- The **temporary rustfmt patch publisher was removed** (accepted).
- The **immutable-URL wording is corrected** on all surfaces (accepted).
- **External technical review verdict: PASS**, conditional only on this
  documentation-only closeout commit's CI remaining green.
- **Human acceptance, the Ready-for-Review transition, and merge remain
  separate decisions and are NOT granted.** PR #4 stays Draft, OPEN,
  unmerged, and not Ready for Review.

## Status

**External technical review passed (conditional on closeout CI); awaiting
human acceptance.** Milestone One is *not* marked complete or accepted
anywhere. No milestone or requirement state was advanced by this document.
