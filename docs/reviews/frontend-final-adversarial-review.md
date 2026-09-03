# Frontend Final Adversarial Review — PR #1

**Reviewed commit:** `9773fef` (round 1 reviewed `fe70ee4`)
**Diff reviewed:** `main...9773fef`, plus the round-2 remediation on top
**Method:** the PR description was treated as a claim, not as evidence. Every
conclusion below comes from reading the implementation, executing probe tests,
or mutating the source and observing whether the suite noticed.
**Round:** 2 of a maximum 3.

Six reviewer roles were run as separate passes, each with its own question set
and its own bias. Where a role could not prove a claim by execution, it is
marked as reasoned rather than verified.

---

## Verdict

| Severity | Count | Status |
| --- | --- | --- |
| Critical | 0 | — |
| High | 1 | **FIXED** in round 2 and pinned by 17 regression tests |
| Medium | 2 | **Both fixed** with regression tests |
| Low | 2 | L-1 fixed; L-2 open, non-blocking |
| Informational | 4 | Recorded for the backend phase |

**No Critical or High finding is open.** The gate result below is derived from
these counts, not asserted alongside them: round 1 recorded a PASS while A-1
was open, which was a contradiction and was rejected. A-1 is now fixed, so the
count of unresolved Critical and High findings is zero.

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

### Resolution *(round 2 — FIXED)*

Round 1 filed this as accepted architectural debt. That was wrong: it
contradicted the claim that `StudioRuntimeBridge` is the single replaceable
runtime boundary, so it was fixed before this foundation merges.

What changed:

1. **The circular import was inverted, not worked around.** `run.ts` owns a
   module-level `chatProjection` callback and exports `setChatProjection`;
   `chat.ts` registers itself at module scope. `run.ts` no longer imports
   `chat.ts`, so the graph is acyclic and `connectRunStore()` fans one
   validated subscription out to both stores.
2. **The legacy transport was deleted outright** — `git rm -r
   src/services/transport` — rather than kept dormant "for future use".
3. **A second, dormant text generator was also removed.** `src/mocks/stream.ts`
   still held `pickReply`/`runMockStream`; grepping every export showed only its
   own test file consumed them. Both files were deleted and the one genuinely
   needed helper, `estimateTokens`, moved to `src/lib/tokens.ts`. Deleting the
   "legacy" module alone would have left a second source of assistant text.
4. **`applyRuntimeEvent` is now the sole writer of assistant text**, keyed by
   `activeRun`. Nothing renders `run.text` beside a transport response.
5. **Coverage built on the removed layer was rewritten, not deleted.**
   `chatTransport.test.ts` now exercises the bridge while keeping its real
   assertions: error-key mapping per `RuntimeErrorKind`, dismiss, retry-last,
   retry-noop and all four persistence tests.

### Red-then-green evidence

Every regression test was first run against the **unfixed** implementation.

**RED — `Tests 11 failed | 5 passed (16)`.** The decisive assertion:

```
expected 'Short answer: keep state close to whe…' to contain 'ZQX-SENTINEL-4417'
```

The sentinel existed only inside a bridge `message.delta`. The transcript
instead rendered `MockTransport`'s canned prose, proving the bridge's message
stream was computed and discarded.

**GREEN — `Tests 16 passed (16)`** on `transcriptProjection.test.ts`; full suite
**`Test Files 45 passed (45)` / `Tests 594 passed (594)`**; `tsc -b`,
`tsc -p tsconfig.e2e.json` and `eslint .` all clean.

### End-to-end proof, not isolation-in-a-vacuum

A store-level test cannot prove the feature is mounted. `src/components/__tests__/runtimeTranscript.test.tsx`
renders the real `AppShell`, types a prompt, and asserts the on-screen reply
matches `/I reviewed the workspace/` — a sentence that exists only in
`MockStudioRuntime`'s `NORMAL_REPLY`. If a second message-generation path is
ever reintroduced, this fails.

### Mutation testing of the fix

| # | Mutation | Result |
| --- | --- | --- |
| M1 | `message.delta` no longer appends to the transcript | **caught** — 8 failures |
| M2 | drop `persist()` from `message.completed` only | survived — masked by the `run.completed` persist |
| M2b | drop `persist()` from *both* completion handlers | **caught** — 2 failures |
| M3 | allow a delta after cancellation | **caught** |
| M4 | remove the session-id guard in `run.ts` | **caught** by the run-store suite |
| M5 | stop mapping `run.failed` to an error key | **caught** — 4 failures |
| M6 | never register the chat projection | **caught** — the bridge fan-out is pinned |

M2 is a genuine limitation, disclosed rather than hidden: both handlers write
full state, so either alone satisfies the assertions. The redundancy is
defensive and harmless, and M2b confirms persistence itself is pinned.

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

## L-1 — GitHub Actions were tag-pinned, not SHA-pinned *(FIXED)*

All six `uses:` in `.github/workflows/ci-windows.yml` are pinned to commit SHAs
with version comments. Every SHA was resolved from upstream with `gh api` and
never invented; the annotated `swatinem/rust-cache` tag object was dereferenced
to its commit, and each SHA's exact semver was confirmed via `repos/<r>/tags`.
`.github/dependabot.yml` was added so the pins stay current (weekly,
`github-actions`, limit 5).

### Workflow security audit

`zizmor` v1.30.0 was run against the workflow. It found real issues, which were
fixed rather than suppressed:

| Finding | Severity | Fix |
| --- | --- | --- |
| `artipacked` — checkout persists credentials into `.git/config`, where a later step or uploaded artifact could carry them off the runner | Medium | `persist-credentials: false` |
| `template-injection` — `${{ github.event.pull_request.number }}` expanded directly into a `run:` script | High (pedantic) | passed via a `PR_NUMBER` env var so it can never expand as shell code |
| `excessive-permissions` — `pull-requests: write` at workflow level | High (pedantic) | workflow is `contents: read`; the write scope moved to the one job that needs it |

`zizmor --persona=pedantic` now reports **0 high, 0 medium, 0 low** and a single
informational note (it prefers a `rustup` script step over
`dtolnay/rust-toolchain`); the action is kept because it pins the toolchain
deterministically. The default persona reports no findings.

`actionlint` could not be executed: release-asset downloads from
`release-assets.githubusercontent.com` fail in this sandbox with
`curl: (35) OpenSSL SSL_ERROR_SYSCALL`. This is disclosed rather than glossed
over. The workflow's YAML was parsed successfully by `zizmor`, which validates
structure, but the shell-level checks `actionlint` would add have not run.

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

Fixes applied in round 1:

- `src/stores/run.ts` — session isolation guard (R-1)
- `src/stores/__tests__/run.test.ts` — +2 regression tests
- `src/components/agent/__tests__/RunSummary.test.tsx` — +1 wiring test
- `src/components/sessions/__tests__/SessionList.test.tsx` — +2 rendering tests

Round 1 then declared PASS while A-1 was still open. **That verdict was
withdrawn.** A gate result cannot be asserted alongside an unresolved High
finding; it must follow from the counts. Round 2 exists to fix A-1 rather than
to re-justify it.

---

## Round 2 outcome

- A-1 fixed: dependency inverted via `setChatProjection`, `src/services/transport/`
  deleted, `src/mocks/stream.ts` (a second dormant text generator) deleted,
  `estimateTokens` relocated to `src/lib/tokens.ts`.
- `chatTransport.test.ts` rewritten against the bridge, preserving its real
  error-mapping, retry and persistence coverage.
- +17 regression tests: 16 in `transcriptProjection.test.ts` (including a source
  guard that no file imports a transport module) and 1 end-to-end transcript
  guard rendering the real `AppShell`.
- L-1 fixed: six SHA pins, Dependabot, and three `zizmor` workflow findings
  fixed (credential persistence, template injection, excessive permissions).

Test count moved 600 → 594: the transport and `mocks/stream` suites were removed
along with the code they covered, and 17 tests were added.

---

## Final verdict

| Gate | Result |
| --- | --- |
| Critical findings | **0** |
| High findings | **0** — A-1 fixed and verified, not waived |
| Medium findings | **2 of 2 fixed** |
| Low findings | L-1 fixed; L-2 (`mockRuntime.ts` size) open, non-blocking |
| Unit / component tests | **594 passed**, 45 files |
| End-to-end tests | **100 passed**, 11 spec files |
| Skipped tests | **0** |
| Red-then-green evidence recorded | ✅ `11 failed, 5 passed` → `16 passed` |
| Transcript originates from the bridge | ✅ proven through the real `AppShell` |
| Single runtime boundary | ✅ one message-generation path |
| No active Ollama code / no `127.0.0.1:11434` | ✅ |
| No secrets, tokens or `console.*` in product code | ✅ |
| Workflow security audit | ✅ `zizmor` pedantic: 0 high / 0 medium / 0 low |
| `actionlint` | ⚠️ not run — sandbox cannot reach `release-assets.githubusercontent.com` |

**Result: PASS**, derived from the table above: zero unresolved Critical and
zero unresolved High findings. The one caveat is that `actionlint` could not be
executed in this environment; `zizmor` was run in its place and the workflow
parses cleanly.

The PR remains a **Draft** and was **not merged**. Jcode and real providers are
still not integrated and all agent behaviour is mocked.
