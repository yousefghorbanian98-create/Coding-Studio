# ADR-0001: Official Jcode identity

Status: accepted · Milestone One · 2026-09-05

## Decision

The official Jcode source of truth is `https://github.com/1jehuang/jcode`,
default branch `master`. The identity was verified (not assumed) at inspection
time: GitHub API metadata matched, `git ls-remote`/`clone` succeeded, the
annotated tag `v0.81.7` resolves to commit
`358226c2a35b8b50d4d520b3363b0dc60c000fdb` by tagger identity
`jeremy <94247773+1jehuang@users.noreply.github.com>`, and that commit is an
ancestor of the verified `master` tip
`f11adb5996c541592e28519018709eebebc9fce4`.

## Consequences

- All pins reference tag + commit + asset digests (immutable triple), never a
  moving branch or a "latest" URL.
- The abandoned April 2026 `v0.9.x` release line is explicitly not "newer"
  than the `v0.81.x` line; numeric comparison of tags is meaningless across
  that discontinuity.
- Upstream is cloned only into temporary directories outside this repository;
  nothing is vendored.

Evidence: `../evidence/milestone-one/upstream-provenance.md`.
