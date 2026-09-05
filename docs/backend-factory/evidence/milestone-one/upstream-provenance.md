# Milestone One — Upstream Provenance

Date of verification: 2026-09-05. Verifier: Arena agent session `arena/01a07182-coding-studio`.
All facts below were re-verified at inspection time; the mission's starting
observations were treated as unverified input.

## Repository identity

| Field | Verified value | How verified |
|---|---|---|
| Official repository | `https://github.com/1jehuang/jcode` | `git ls-remote`, GitHub API `repos/1jehuang/jcode` |
| GitHub owner/repo | `1jehuang/jcode` | API `full_name` |
| Default branch | `master` | API `default_branch`; `origin/HEAD -> origin/master` |
| Inspected tip commit | `f11adb5996c541592e28519018709eebebc9fce4` (`docs: update weekly stars chart`, 2026-09-05T03:30:25Z) | `git ls-remote` HEAD + local clone `git log -1` |
| Repository created | 2026-01-05 | API `created_at` |
| Last push | 2026-09-05T03:30:26Z | API `pushed_at` |
| Archived/disabled | false/false | API |
| Stars / open issues | 19136 / 397 | API (maintenance-activity signal) |

Clone location during verification: `/tmp/jcode-upstream` (outside this
repository, `git clone --filter=blob:none`). Nothing was vendored into this
repository.

## Mission-start observations vs verified facts

| Observation | Verdict |
|---|---|
| Official repository `1jehuang/jcode` | confirmed |
| Default branch `master` | confirmed |
| Upstream commit `f11adb5996c541592e28519018709eebebc9fce4` | confirmed (still tip at inspection time) |
| Latest release candidate `v0.81.7` | confirmed (API `/releases/latest`) |
| Release date 2026-09-04 | confirmed (`published_at` 2026-09-04T21:38:18Z) |
| License candidate MIT | confirmed (LICENSE file + API `license.spdx_id`) |

## Tag and release identity (selected release v0.81.7)

| Field | Value | Evidence |
|---|---|---|
| Tag name | `v0.81.7` | `git ls-remote --tags`, API |
| Tag type | annotated tag object | `git cat-file -t v0.81.7` -> `tag` |
| Tag object SHA | `2c05ae6f8af7a65ad58edece03404a8f267a432a` | `git rev-parse v0.81.7` |
| Tagged commit | `358226c2a35b8b50d4d520b3363b0dc60c000fdb` | `git rev-parse v0.81.7^{}` |
| Tagger | `jeremy <94247773+1jehuang@users.noreply.github.com>` (noreply identity of repo owner `1jehuang`) | `git cat-file -p v0.81.7` |
| Tag message | `GPT-6 Astra default` (matches release name) | same |
| Tag commit belongs to official repo | YES — `git merge-base --is-ancestor v0.81.7^{} f11adb5996c541592e28519018709eebebc9fce4` | local clone |
| Release draft/prerelease | false/false | API |
| Release `target_commitish` | `master` | API |
| Release published | 2026-09-04T21:38:18Z | API |

## Version-line discontinuity (guards against "higher number = newer" confusion)

Tags `v0.9.0`–`v0.9.8` exist but their GitHub releases were published between
2026-04-07 and 2026-04-11 — an older, abandoned versioning line (v0.9.0 and
v0.9.1 have no releases at all). The live line is `v0.80.0` → `v0.81.7`
(2026-08-24 → 2026-09-04). Coding Studio therefore pins by **exact tag +
tagged commit + asset digests**, never by "latest" or by numeric maximum.
Mutable references are never used as the frozen source.

## Maintenance activity signals

- 17 commits touched `crates/jcode-harness-api` between 2026-08-01 and
  inspection (active development, mitigated by upstream schema snapshot tests,
  see `docs/backend-factory/evidence/milestone-one/capability-matrix.md`).
- Recent harness-API commits include Windows transport support
  (`fd778e07 Support SDK transport on Windows`, `7ece0849 fix(sdk): launch API
  bridge through jcode CLI`, `cd9d3661 fix(sdk): silence Windows launch warning`).
- 397 open issues. Integration-relevant open issues recorded:
  - `#977` Harness API: `detach_session` should detach without aborting an
    in-flight turn — matters for Milestone Four lifecycle design, not M1.
  - `#498` Windows exe intermittently crashes at launch showing garbled text —
    flag for the Milestone Two supervisor; M1 does not launch the binary in
    product code.
  - `#1081` Windows: bg cancel reports success while npm/cmd/Vitest
    descendants remain running — relevant to Milestone Two/ Four process-tree
    handling.
  - `#1108` TLS/connectivity error on Windows — provider-side, out of M1 scope.
  - `#1038` winget distribution request — packaging only.

## Doc drift note

`crates/jcode-harness-api/src/lib.rs` references
`docs/HARNESS_API_AND_DESKTOP_REWRITE.md`, which does not exist at commit
`358226c2` (upstream deleted in-repo desktop implementations in `2a256b4a`).
The crate-level contract documentation (versioning rules, NDJSON framing,
unknown-field tolerance) is nonetheless complete in the source itself and in
upstream schema-snapshot tests; this is recorded as low-severity upstream docs
drift, not a blocker.
