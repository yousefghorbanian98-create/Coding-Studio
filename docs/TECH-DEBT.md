# Known technical debt

Tracked deliberately so it is visible rather than discovered later. Nothing here
blocks the frontend foundation; each entry names the trigger that should force
the work.

## L-2 — `mockRuntime.ts` is large

`src/services/runtime/mockRuntime.ts` holds every mock scenario in one file. It
is readable today because the scenarios are flat and independent, and splitting
it now would churn a file that the scenario-lab slice is still adding to.

**Why it is not urgent:** it is dev-only. It never ships to production — the
production bundle contains zero scenario-lab chunks — and it implements the same
`StudioRuntimeBridge` interface the real runtime will, so replacing it is a
one-line swap in `src/services/runtime/index.ts`.

**Trigger to fix:** when Jcode lands and the mock becomes a test fixture rather
than the default runtime, split it into one module per scenario family
(`scenarios/normal.ts`, `scenarios/approval.ts`, `scenarios/failure.ts`, …) with
a registry, so a scenario can be added without touching shared code.

## `actionlint` has never been run against the CI workflow

Release-asset downloads from `release-assets.githubusercontent.com` fail in the
development sandbox with `curl: (35) OpenSSL SSL_ERROR_SYSCALL`, so the binary
could not be fetched. `zizmor` v1.30.0 was run instead and reports no findings
below the informational level.

**Trigger to fix:** add `actionlint` as a CI step, where network access to the
release assets is available. That also makes it continuous rather than a
one-off local check.

## Two redundant `persist()` calls on run completion

`message.completed` and `run.completed` both call `persist()`, and each writes
full state, so either alone is sufficient. Mutation M2 in the round-2 review
survived for exactly this reason. The redundancy is harmless and defensive; it
is recorded so a future reader does not mistake the surviving mutant for missing
coverage. Mutation M2b, which removes both, is caught.

## The mission's `interrupted` run state is not a distinct phase

User-initiated stops resolve to `cancelling` → `cancelled`; runtime-side aborts
resolve to `failed` with a typed error kind. See `docs/ARCHITECTURE.md`. Revisit
only if a real runtime reports an abort that is neither of those.

## Timing-sensitive tests are a recurring failure mode

Three tests failed only on the Windows CI runner because they waited a fixed
number of milliseconds and then asserted. Each was rewritten to wait on an
observable condition. The rule to keep: never assert after a sleep — wait for
the state the assertion depends on, and if a run must still be in flight, use a
scenario and tick that guarantee it.

**Trigger to fix further:** if a fourth instance appears, add a lint rule
banning `waitForTimeout` and bare `setTimeout` sleeps in test files.
