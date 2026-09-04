# Factory State Machine

## Roles

- Specifier
- Builder
- Reviewer
- Security Reviewer
- Protocol Reviewer
- Windows Reviewer
- Self-Heal Debugger

Specifier and Builder must not approve their own output. Review must use fresh
reviewer contexts whenever the environment supports it. Merge, real OAuth,
purchases, secrets and releases remain human-controlled.

## Finn-derived autonomous loop

Upstream Finn-loop is human-gated (`finn-spec` files an issue, the human labels
it `agent-ready`, `finn-build` opens the PR, `finn-review` posts a verdict, the
human merges). Coding Studio derives a safe autonomous mode with the same
contract-first discipline:

1. **Specify.** Materialize the requirement with acceptance criteria, non-goals,
   threats, implementation files and tests.
2. **Plan.** Map the requirement to milestone and stage and record the gate.
3. **Build.** Implement only the approval boundary; no unrelated refactors.
4. **Review.** Run independent fresh contexts.
5. **Verify.** Run targeted and regression tests; Windows CI is authoritative.
6. **Self-heal.** Observe, classify, reproduce, minimize, hypothesize, patch,
   targeted test, regression test, independent review, accept or retry.
7. **Freeze.** Hash evidence into the manifest.
8. **Humans control.** Merge, real OAuth, purchases, secrets and releases.

## Mission state fields

`.factory/state.json` captures:

- schema version
- run identifier
- repository
- branch
- base commit
- active milestone
- active stage
- active gate
- status
- attempt counters
- last progress time
- last commit
- last CI run
- completed stages
- pending stages
- blocked stages
- blockers

`.factory/journal.jsonl` is append-only. No secrets are written to state or
journal. Git and GitHub are higher sources of truth than stale local state.
Recovery must never discard uncommitted user changes.

`lastCommit` records the most recent verified commit SHA on this branch at the
time the record was last updated; it is `null` until such a commit is recorded,
and it is not required to pre-record the current uncommitted working tree.
`lastCIrun` records the most recent completed Windows CI run identifier for that
recorded commit; it is `null` when no verified CI run for that commit has been
observed. A CI run generated only after committing the record is intentionally
not required to exist when the record is written.

## Stage transitions

```text
planned -> active -> complete
planned -> active -> blocked
blocked -> active (only after the blocker clears)
future -> pending (only after all required backend milestones pass)
```

## Autonomous loop safety

The loop has finite retry limits, circuit breakers, recovery state, secret
redaction and auditable evidence. See `12-SELF-HEAL-RUNBOOK.md` for the exact
limits and `13-RECOVERY-RUNBOOK.md` for recovery behavior.
