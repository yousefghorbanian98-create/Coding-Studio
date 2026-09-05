# Recovery Runbook

The recovery state machine is deterministic and must never discard uncommitted
user changes.

## Recovery contexts

- application shutdown
- Jcode crash
- Coding Studio restart
- runtime restart
- session resume
- interrupted sessions
- partial-response preservation
- worker crash or partial failure in Ruflo (optional orchestrator)

## Recovery steps

1. **Observe and classify.** Record the failure event in the append-only
   journal. Never overwrite local state.
2. **Preserve.** Check for uncommitted user changes before any reset or recovery
   action. Recovery must never discard them.
3. **Reconcile.** Use Git and GitHub as the higher source of truth when local
   state is stale.
4. **Resume.** Restore session identity and partial responses; mark incomplete
   or partial output clearly when it cannot be restored exactly.
5. **Redact.** Ensure secrets are removed from all diagnostic and recovery
   output.
6. **Continue.** Resume only the affected stage; dependent stages wait until the
   blocked or failed stage is resolved.
7. **Escalate.** If the self-heal limits are reached or the circuit breaker is
   open, stop the affected stage, record evidence and create or update a
   blocker issue.

## Journal

The journal is append-only. No secrets are written to state or journal files.
