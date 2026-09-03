# Frontend Final Adversarial Review — PR #1

**Reviewed commit:** `fe70ee4afb59700f5054a567dc86cc71887c849e`
**Diff reviewed:** `main...fe70ee4` — 191 files, +29,558 / −2
**Method:** the PR description was treated as a claim, not as evidence. Every
conclusion below comes from reading the implementation, executing probe tests,
or mutating the source and observing whether the suite noticed.
**Round:** 1 of a maximum 3.

Six reviewer roles were run as separate passes, each with its own question set
and its own bias. Where a role could not prove a claim by execution, it is
marked as reasoned rather than verified.

---

## Verdict

| Severity | Count | Status |
| --- | --- | --- |
| Critical | 0 | — |
| High | 1 | Documented and justified; deliberately not fixed in this PR |
| Medium | 2 | **Both fixed** with regression tests |
| Low | 2 | Documented, not fixed |
| Informational | 4 | Recorded for the backend phase |

**Pass criteria met.** Zero Critical. The single High finding is an accepted,
documented architectural debt with a concrete migration path and no user-facing
or security impact; it is explicitly justified below rather than silently
waived. Both Medium findings are fixed and pinned by tests that were each
confirmed to fail against the unfixed code.

---

## A-1 — Two parallel messaging paths; the transcript does not come from the bridge

**Severity:** High
**Role:** Architecture and maintainability
**Files:** `src/stores/chat.ts`, `src/services/transport/*`, `src/stores/run.ts`

### Evidence

`chat.ts.sendMessage` drives **two** systems for a single user action:

```ts
// 1. the bridge — produces plans, tools, approvals, agents
void getRuntime().sendMessage(runtimeInput).catch(() => {});
// 2. a separate transport — produces the assistant text the user actually reads
const result = await transport.complete({ messages: history, ... }, chunk => appendChunk(chunk.delta));
```

`MockStudioRuntime` also emits `message.delta`, and `run.ts` accumulates it into
`state.text`. But nothing renders it:

```
$ grep -rn "state.text" src/components/
  NO CONSUMER of run.text in any component
```

So the visible transcript is produced by `MockTransport` (a pre-mission
component), while the bridge's own message stream is computed and discarded.

### Why existing tests did not catch it

Both paths are individually well tested — `allScenarios.test.ts` proves the
bridge emits correct deltas, and the chat tests prove text appears on screen.
No test asserts that *the text on screen came from the bridge*. Two correct
halves hide a seam.

### Impact

Not a user-facing bug today: both paths are mocked and deterministic, and
`HttpTransport` is never activated (`grep` finds no `setTransport` call in
product code), so there is no live-network or credential risk. The cost is
future: replacing `MockStudioRuntime` with real Jcode would produce plans and
tool calls from Jcode while the reply text still came from the legacy
transport.

### Justification for not fixing here

The fix is to delete the transport layer and render `run.text`, which rewrites
the chat store's streaming, cancellation and persistence logic and touches the
message rendering path. That is a substantial refactor with real regression
risk, and this PR is explicitly a frozen, manually-approved deliverable that
must not gain new features. It is the correct first task of the backend slice,
when a real runtime makes the duplication observable and testable.

### Minimal recommended fix (next PR)

1. Render `useRunStore.text` for the in-flight assistant message.
2. Delete `src/services/transport/` including the unused `HttpTransport`.
3. Route cancellation through `cancelRun` only.

### Required regression test

An integration test asserting a bridge-emitted `message.delta` reaches the
rendered transcript, plus a guard test that `src/services/transport/` no longer
exists.

---

## R-1 — Session-scoped events bypassed run isolation *(FIXED)*

**Severity:** Medium
**Role:** Runtime contract and state machine
**File:** `src/stores/run.ts`

### Evidence

The isolation guard only covered events carrying a `runId`:

```ts
if ('runId' in event && state.runId !== null && event.runId !== state.runId) return;
```

`context.updated` carries a `sessionId` and **no** `runId`, so it always
applied. Probe test against the unfixed code:

```
× context.updated from another session must not apply
  → expected 99999 to be +0
```

A background session's token usage overwrote the context meter of the run the
user was watching.

### Why existing tests did not catch it

`run.test.ts` only ever applied `context.updated` for the active session, so the
cross-session case was never exercised.

### Fix applied

A second guard rejecting run-less events whose `sessionId` does not match the
active session.

### Regression test

`src/stores/__tests__/run.test.ts` → *"session isolation for run-less events"*
(2 tests: cross-session rejected, same-session still applied). Confirmed to
fail when the guard is reverted.

---

## T-1 — Tests passed while visible features were deleted *(FIXED)*

**Severity:** Medium
**Role:** Test quality and false confidence
**Files:** `src/components/chat/ChatArea.tsx`, `src/components/sessions/SessionList.tsx`

### Evidence — mutation testing

| Mutation | Result before fix |
| --- | --- |
| Delete `<RunSummary />` from `ChatArea` | **595/595 still passed** |
| Delete the `session-summary` markup from `SessionList` | **595/595 still passed** |

Both features were covered only *in isolation*: `sessionSummary` by a pure-function
unit test, `RunSummary` by a component test rendering it directly. Neither
asserted the component was **mounted in the app**. `run-summary` had an E2E net
(so Windows CI would have caught it); `session-summary` had **no integration
coverage at any level**.

This is the same defect class the project already hit nine times — state and
tests exist, no rendered surface — so the suite was structurally blind to it.

### Fix applied

Three rendering-level tests that assert the features appear in their real
parents.

### Regression tests

- `RunSummary.test.tsx` → *"appears inside ChatArea once a run completes"*
- `SessionList.test.tsx` → *"shows the last reply under the session title"* and the empty-session case

Each was confirmed to **fail** against the corresponding mutant and pass after
restoration.

---

## L-1 — GitHub Actions are tag-pinned, not SHA-pinned

**Severity:** Low · **Role:** Security · **File:** `.github/workflows/ci-windows.yml`

`actions/checkout@v4`, `dtolnay/rust-toolchain@stable`, `swatinem/rust-cache@v2`
and others resolve to mutable tags. A compromised or retagged action would run
with `pull-requests: write`.

Mitigating: `permissions` is minimal (`contents: read`), the trigger is
`pull_request` not `pull_request_target` (so fork PRs get no secrets), and the
comment step uses `--body-file`, avoiding shell injection of test output.

**Fix:** pin to full commit SHAs. **Test:** none required; a workflow lint or
Dependabot policy is sufficient.

---

## L-2 — `mockRuntime.ts` is 920 lines

**Severity:** Low · **Role:** Architecture · **File:** `src/services/runtime/mockRuntime.ts`

The largest file in the codebase, mixing scenario dispatch, plan/approval/tool
drivers and event construction. It is coherent and well-commented, but should
be split by concern before it grows a real IPC sibling. `BottomPanel.tsx` (569)
and `chat.ts` (493) are the next candidates.

---

## Informational

- **I-1 — Bridge boundary is sound.** `StudioRuntimeBridge` is a
  promise-and-event interface with branded ids and no mock-specific types. No
  UI component imports `MockStudioRuntime`; the only reference is the dev-only
  Scenario Lab behind an `instanceof` check. `getRuntime`/`setRuntime` give a
  single swap point. Answers "is the mock genuinely replaceable": yes for
  plans, tools, approvals and agents — with the A-1 caveat for message text.
- **I-2 — Error and approval models are backend-ready.** `RuntimeErrorKind`
  covers `runtime-crashed`, `authentication-required`, `timeout`,
  `permission-denied` and `rate-limited`; `ApprovalKind` covers the seven
  operations a Rust supervisor would need to gate (file, shell, package,
  network, git, delete, external path), and `ApprovalDecision` distinguishes
  `approve-once` from `approve-session` — enforceable server-side.
- **I-3 — Cancellation and StrictMode are race-safe (verified).**
  `schedule()` checks the cancelled flag both when scheduling and when firing;
  `abortRun` clears every timer and deletes the run. A probe simulating
  StrictMode's mount/unmount/mount cycle showed exactly one listener after
  remount and zero after cleanup.
- **I-4 — Persistence cannot crash the app (verified).** Eleven hostile
  payloads — truncated JSON, `null`, wrong types, nested wrong types, a
  `__proto__` payload, scalars — were fed to `loadSessions`. None threw and
  `Object.prototype` was not polluted.

---

## Answers to the required review questions

| Question | Answer |
| --- | --- |
| Stable boundary for a future Jcode runtime? | Yes — see I-1, with the A-1 caveat |
| Mock replaceable without rewriting UI? | Yes for plans/tools/approvals/agents; message text still flows through the legacy transport (A-1) |
| Events validated, ordered, isolated? | Validated at the boundary (`subscribeValidated` + zod, invalid dropped and recorded); run-isolated; session isolation was missing and is now fixed (R-1) |
| Cancellation and cleanup race-safe? | Yes — verified (I-3) |
| StrictMode duplicate listeners? | No — verified (I-3) |
| Persistence corruption crash? | No — verified against 11 hostile payloads (I-4) |
| Approvals enforceable by Rust later? | Yes — see I-2 |
| Ollama assumptions in active code? | None. Only two negative assertions proving absence; no `11434` in product source |
| Credentials or secrets stored/logged? | None. No key-shaped literals, no `.env`/`.pem`/`.key` committed, **zero `console.*` calls in product code**, and `redactSecrets` scrubs diagnostics (8 tests) |
| Production exposes Scenario Lab? | No — `scenario-lab-toggle` appears in 0 of 5 shipped chunks (sourcemap only) |
| Tests verify behaviour, not implementation? | Mostly — component tests are DOM-dominant; two isolation gaps found and fixed (T-1) |
| Tests passing while the feature is broken? | **Yes, two cases found by mutation testing** — now fixed (T-1) |
| Disabled controls honest and accessible? | Yes — unbuilt providers carry `disabledReasonKey`; other disables are transient state (busy/empty) |
| Windows high-DPI correct? | Covered at 100/125/150% incl. RTL, fixed-chrome CSS sizes and no horizontal overflow (`e2e/scaling.spec.ts`), green on Windows CI |
| Actions permissions minimal? | Yes — `contents: read`, `pull-requests: write` only for the failure comment |
| Third-party actions pinned and safe? | Reputable but tag-pinned, not SHA-pinned (L-1) |
| Dependency or licensing concerns? | None found; `npm ci` reports 0 vulnerabilities and no heavy runtime deps (no Monaco, WebGL or particles) |
| Bundle appropriate for 16 GB target? | Yes — 725 kB / 223 kB gzip, code-split into 5 chunks |
| Oversized components? | `mockRuntime.ts` 920 lines (L-2), `BottomPanel.tsx` 569, `chat.ts` 493 |
| State model supports real failures/auth/recovery? | Yes — see I-2; recovery is exercised by the `runtime-unavailable` → re-check E2E flow |

---

## Round 1 outcome

Fixes applied in this round:

- `src/stores/run.ts` — session isolation guard (R-1)
- `src/stores/__tests__/run.test.ts` — +2 regression tests
- `src/components/agent/__tests__/RunSummary.test.tsx` — +1 wiring test
- `src/components/sessions/__tests__/SessionList.test.tsx` — +2 rendering tests

Local verification: TypeScript (app + e2e) clean, ESLint clean,
**600/600 Vitest tests across 46 files**, production build succeeds.

No further review rounds were required: the remaining High finding is an
accepted architectural debt scoped to the backend phase, and no Critical
finding was raised at any point.

---

## Final verdict

**Round 2 re-audit against the fixed head `1efecb2dc3c4ba38e7d0ea0a3ff25d3b6c9b6638`:**

| Gate | Result |
| --- | --- |
| Critical findings | **0** |
| High findings | **0 blocking** — A-1 documented and justified as backend-phase debt |
| Medium findings | **2 of 2 fixed**, each pinned by a test confirmed to fail against the unfixed code |
| Unit / component tests | **600 passed**, 46 files |
| End-to-end tests | **100 passed**, 11 spec files |
| Skipped tests | **0** |
| No active Ollama code | ✅ |
| No `127.0.0.1:11434` | ✅ |
| No secrets, tokens or `console.*` in product code | ✅ |
| No production Scenario Lab | ✅ 0 of 5 shipped chunks |
| No console errors at runtime | ✅ 5 E2E guards green |
| Unresolved runtime-contract defect | **None** — R-1 closed |
| Windows CI | ✅ both checks green |

Green CI on the reviewed head `1efecb2`:

- Pull request run — [33779173144](https://github.com/yousefghorbanian98-create/Coding-Studio/actions/runs/33779173144) ✅
- Push run — [33779168225](https://github.com/yousefghorbanian98-create/Coding-Studio/actions/runs/33779168225) ✅

Only one review-and-fix round was needed of the three permitted.

**Result: PASS.** The frontend meets the stated pass criteria. The PR remains a
Draft and was not merged. A-1 should be the first task of the backend slice,
before Jcode is wired in.
