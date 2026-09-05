# Finn-loop Research

## Repository metadata

- Repository URL: `https://github.com/finna/Finn-loop`
- Inspected commit SHA: `7941b62c946154d15c11b7f24931bb8b6e155f01`
- Default branch: `main`
- License: MIT
- Description upstream: "The Finn-loop: a 3-skill AI software factory for Claude Code — spec, build, review. Humans merge."

## Files inspected

- `LICENSE`
- `README.md`
- `scripts/validate.mjs`
- `.github/workflows/validate.yml`
- `skills/finn-spec/SKILL.md`
- `skills/finn-build/SKILL.md`
- `skills/finn-review/SKILL.md`

## Upstream requirements and assumptions

- A Git repository hosted on GitHub with a working `origin` remote.
- Claude Code 2.1.71 or newer (`/loop`).
- A Linear workspace and team, and the Linear connector.
- GitHub CLI authenticated with write access.
- Required GitHub status checks for fully automated `loop-approved` verdicts.
- Assumption that the default branch is detected via `gh repo view`, never hardcoded.
- Assumption that dirty worktrees are protected and not overwritten.
- Human-gated merge is the default: spec interviews, humans label `agent-ready`, builder claims and opens a PR, reviewer posts a verdict, humans merge.

## Adopted patterns

- Contract-first specification with stable acceptance criteria (`AC-N`) and non-goals (`NG-N`).
- Non-goals are binding and cross-checked against acceptance criteria.
- Preflight before any change: verify repository identity, `origin` reachable, detect default branch, require a clean working tree, protect uncommitted work.
- One unit of work per pass; no unrelated refactors.
- Builder verifies with narrow checks first and preserves evidence for unrelated pre-existing failures.
- Reviewer inspects actual diffs and current head; records exact reviewed SHA; handles unknown mergeability by waiting instead of guessing.
- Reviewer checks required CI; missing required CI escalates for human review instead of being treated as green.
- A verdict is posted as a comment plus labels (not a formal GitHub review) because the loop may run on the PR author's token.
- Hard limits: never merge, never push to the PR branch, never enable auto-merge.
- Labels/state are cooperative and preserved when a separate high-risk human gate exists.
- Small, chainable work items; each buildable on the previous merged code.

## Rejected patterns

- Binding to Linear: Coding Studio is not assumed to have Linear configured, so the mission uses GitHub Issues, Draft pull requests, labels and repository state files instead.
- Dependency on Claude Code-only `/loop` execution: Coding Studio uses a documented autonomous mode with the same discipline rather than a vendor loop.
- Auto-applying `loop-approved` when required CI is missing: Coding Studio keeps a human gate when evidence is missing.
- Renaming or guessing the default branch: Coding Studio detects the repository default branch.
- Treating the three upstream SKILL.md files as an install and copying them verbatim: Coding Studio only adopts the generalized contract-first and review discipline, not the files.

## Deviations required by Coding Studio

- Replace Linear with GitHub Issues, Draft PRs, labels and repository state files when Linear is not configured.
- Keep merge, real OAuth, purchases, secrets and releases human-controlled.
- Add mandatory acceptance criteria, non-goals, threats, implementation files, tests, evidence, commit and CI run to every requirement.
- Use deterministic machine validation instead of relying on conversation context.
- Use append-only journaling and a frozen manifest to make evidence auditable.
- Make the loop self-healing but bounded with circuit breakers.

## How the human-gated upstream model becomes a safe autonomous derived model

1. Upstream Finn-loop is human-gated: `finn-spec` interviews and files, humans label `agent-ready`, `finn-build` builds and opens the PR, `finn-review` reviews, humans merge.
2. Coding Studio derives a **Finn-derived autonomous mode** by keeping the same gates that are safe to automate and moving gates that require authority to a human boundary:
   - Specification and evidence materialization can be automated when the acceptance criteria, non-goals, threats and tests are explicit.
   - Build, targeted test, regression test and independent review can be automated.
   - Merge, real OAuth, purchases, secrets and releases stay human-controlled.
   - The autonomous loop is bounded by finite retry limits, circuit breakers, recovery state and auditable evidence.
3. The derived model is documented as a state machine and enforced by the mission validator, so the loop cannot silently skip a gate or mark a requirement complete without reproducible evidence.

Finn-loop is not a production runtime dependency.
