# Self-Heal Runbook

Every failure enters an explicit self-healing debug cycle.

## Cycle

1. OBSERVE
2. CLASSIFY
3. REPRODUCE
4. MINIMIZE
5. HYPOTHESIZE
6. PATCH
7. TARGETED_TEST
8. REGRESSION_TEST
9. INDEPENDENT_REVIEW
10. ACCEPT_OR_RETRY

## Finite limits

- five healing attempts per defect
- five CI remediation attempts
- three review and fix rounds
- three no-progress iterations
- two identical failure fingerprints

## Non-progress rules

- A retry without new evidence is not progress.
- A documentation-only status change is not progress.
- A test timeout increase without evidence is forbidden.
- A weakened assertion is forbidden.
- Deleting a failing test is forbidden.
- Every real defect requires a regression test proven red against the defect.

## Circuit breaker

When the limits are reached:

- open the circuit breaker
- stop the affected stage
- record evidence
- create or update a blocker issue
- do not continue dependent stages

Do not continue dependent stages after the breaker is open.
