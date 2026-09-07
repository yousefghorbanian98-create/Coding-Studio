# Milestone Two Finn Loop Research

## Reference

- Repository: https://github.com/finna/Finn-loop
- Inspected commit: `7941b62c946154d15c11b7f24931bb8b6e155f01`
- License: MIT
- Files inspected: `README.md`, `skills/finn-spec/SKILL.md`, `skills/finn-build/SKILL.md`, `skills/finn-review/SKILL.md`

## Upstream Loop Structure

Finn Loop is a three-skill AI software factory: spec, build, review. The
explicit rule is "humans merge". Key properties observed:

- Contract-first: "If it is not in the Linear issue, it does not exist. No side-channel instructions."
- One unit of work per pass: "One issue per PR, sized to a day of agent work or less."
- Binding non-goals: "Acceptance criteria are observable outcomes; non-goals are binding. A PR comment or review cannot expand scope — only editing the Linear issue can."
- Fresh reviewer context: "The next step is to have the builder open its PR and then launch a fresh reviewer with clean context. Do not let the builder review its own work from the same conversation."
- Bounded retry: "After two failed fix rounds, label the PR loop-stuck and stop for a human."
- Scope immutability: "An agent should not argue with a reviewer forever or silently broaden the Linear contract to make a test pass."

## Bounded Milestone Two Loop

Derived from the upstream discipline, adapted to the Coding Studio state
machine:

### Phase 1 — Preflight
Verify repository identity, branch, clean tree, Milestone One complete,
Milestone Three untouched. Stop on any preflight failure.

### Phase 2 — Research
Inspect Finn Loop, n8n-workflows, Taste Skill, Windows Job Object
documentation, and Rust dependency candidates. Record findings in evidence
files. No external artifact is executed or imported.

### Phase 3 — Threat Modeling
Enumerate installation and supervisor threats. Record planned mitigations
with honest statuses: planned mitigation, evidence required, accepted
limitation, blocked, or not applicable. Do not claim a mitigation exists
before implementation.

### Phase 4 — Architecture Rehearsal
Document at least twenty-five failure scenarios. For each, record expected
state transition, owned handles and files, cleanup responsibility, stable
error class, retryability, test strategy, and unresolved limitation.

### Phase 5 — Implementation Slice
Implement only requirements marked in-progress. No scope creep. No unrelated
refactors. Each slice produces evidence and passes local validation before
commit.

### Phase 6 — Local Validation
Run `npm ci`, `npm run validate:mission`, `npm run lint`,
`npm run typecheck`, `npm run test`, and Rust toolchain checks when a Rust
toolchain is available. Do not claim unavailable checks passed.

### Phase 7 — Windows CI
Push triggers both `push` and `pull_request` events. Monitor both to
completion. Do not claim Windows evidence until CI runs execute.

### Phase 8 — Failure Fingerprinting
For each CI failure, record one exact new fingerprint: the failed step,
the error message, the commit SHA, and the run identifier. Never repeat an
identical failed intervention without new evidence.

### Phase 9 — Bounded Remediation
Milestone Two remediation budget: 5 attempts. Each attempt must address a
distinct fingerprint. If the budget is exhausted, stop and escalate to the
human reviewer. Never weaken a test or security control to pass CI.

### Phase 10 — Adversarial Review
Use an independent review context. Verify no scope violation, no security
regression, no test weakening, and no frozen-hash drift.

### Phase 11 — External Review Hold
Draft PR remains open and unmerged. All eight Milestone Two requirements
remain in-progress until external review passes. Merge remains
human-controlled.

## Stop Conditions

The loop must stop and report to the human reviewer when:

1. The remediation budget is exhausted.
2. An identical failure fingerprint recurs.
3. A threat has no planned mitigation and cannot be accepted.
4. A dependency candidate fails OSS adoption policy.
5. Scope creep is requested (must go through a new milestone).
6. External review is required before further progress.

## Forbidden Repetition

The loop must not repeat an identical failed intervention without new
evidence. If the same remediation produces the same failure twice, the
loop stops and escalates.
