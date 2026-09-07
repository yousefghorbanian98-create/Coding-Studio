# Milestone Two Architecture Rehearsal

This document rehearses failure scenarios for the managed installer and
process supervisor before implementation. Each scenario records the expected
state transition, owned handles and files, cleanup responsibility, stable
error class, retryability, test strategy, and unresolved limitations.

## Installer Scenarios

### 1. Binary discovery (two authorized sources)

INSTALL-001 permits exactly two deterministic discovery sources:

**Source A: Explicit user-configured absolute path**

**Scenario:** User configures an explicit absolute path to the Jcode executable.
**Expected state transition:** `Idle → Discovering → ExplicitPathValidation → Discovered(version) → Idle`
**Validation requirements:**
- Must be absolute; filename-only input is rejected
- Canonicalize and inspect the final file
- Reject directory, reparse/symlink/junction escape, wrong architecture, wrong byte digest, wrong Jcode identity
- Do not copy or mutate the explicit executable
- Explicit invalid input fails closed rather than silently falling back to PATH

**Stable error class:** `InstallError::ExplicitPathInvalid`
**Retryability:** No; user must provide valid absolute path.
**Test strategy:** Unit tests for explicit valid absolute path, relative path (rejected), filename-only path (rejected), PATH-only executable (rejected), explicit path to wrong binary (rejected), explicit reparse escape (rejected).

**Source B: Application-managed version directory**

**Scenario:** Jcode binary exists at the managed path and matches the pinned version.
**Expected state transition:** `Idle → Discovering → ManagedPathValidation → Discovered(version) → Idle`
**Validation requirements:**
- Derive from private managed root plus pinned version/architecture
- Validate containment and exact expected filename
- Verify exact size, digest, architecture, and Jcode identity
- If absent or invalid, enter managed installation or stable repair flow
- Never search PATH

**Owned handles/files:** Read access to binary path, version query handle.
**Cleanup responsibility:** None.
**Stable error class:** `InstallError::VersionQueryFailed`
**Retryability:** Yes, on transient I/O errors.
**Test strategy:** Unit test with managed valid binary, managed corrupt binary (triggers repair).

### 2. Managed install discovery

**Scenario:** No binary found at either authorized source; managed install initiates download and installation.
**Expected state transition:** `Idle → Discovering → NotFound → Downloading → Verifying → Promoting → Discovered(version) → Idle`
**Owned handles/files:** Download temp file, final binary path, HTTP response handle.
**Cleanup responsibility:** Installer cleans temp file on any failure.
**Stable error class:** `InstallError::DownloadFailed`, `InstallError::ChecksumMismatch`, `InstallError::PromotionFailed`
**Retryability:** Download retryable (transient); checksum mismatch not retryable.
**Test strategy:** Integration test with mock HTTP server.
**Unresolved limitation:** None.

### 3. Untrusted PATH candidate

**Scenario:** Binary found on PATH but not at an authorized source (neither explicit absolute path nor managed directory).
**Expected state transition:** `Idle → Discovering → UntrustedPathCandidate → Rejected → NotFound → ...`
**Owned handles/files:** None.
**Cleanup responsibility:** None.
**Stable error class:** `InstallError::UntrustedPath`
**Retryability:** No; PATH discovery is not permitted by INSTALL-001.
**Test strategy:** Unit test with PATH containing non-managed binary and no explicit path configured.
**Unresolved limitation:** User may have a valid system-installed Jcode; policy rejects it for security. User must configure explicit absolute path or use managed installation.

### 4. Version-scoped HTTPS download

**Scenario:** Download binary from pinned version URL.
**Expected state transition:** `NotFound → Downloading(progress) → Downloaded(temp_path)`
**Owned handles/files:** HTTP response body, temp file handle, progress channel.
**Cleanup responsibility:** Installer closes HTTP response and temp file on completion or failure.
**Stable error class:** `InstallError::DownloadFailed`
**Retryability:** Yes, with bounded backoff (3 attempts).
**Test strategy:** Integration test with mock HTTPS server serving versioned binary.
**Trust anchor:** The Coding Studio trust anchor is the exact architecture-specific executable SHA-256 digest accepted and recorded in Milestone One. The GitHub release asset, SHA256SUMS file, and GitHub API metadata are corroborating observations inside the GitHub trust domain. The accepted tag and tagged commit are provenance evidence, not binary-integrity substitutes. The installer must verify the exact architecture-specific digest before promotion and execution.
**Unresolved limitation:** None.

### 5. Redirect to unauthorized host

**Scenario:** Download URL redirects to a host not in the allowlist.
**Expected state transition:** `Downloading → RedirectBlocked → NotFound`
**Owned handles/files:** HTTP response (redirect), no temp file written.
**Cleanup responsibility:** Installer rejects redirect, closes response.
**Stable error class:** `InstallError::UnauthorizedRedirect`
**Retryability:** No; configuration error.
**Test strategy:** Unit test with mock server returning 302 to unauthorized host.
**Unresolved limitation:** None.

### 6. Oversized download

**Scenario:** Download exceeds the exact expected architecture-specific size. Three distinct failure cases:
- Content-Length header differs from the exact expected size (when present).
- Actual streamed bytes exceed expected size by even one byte.
- Stream ends before the exact expected size.

**Expected state transition:** `Downloading → SizeMismatch → NotFound`
**Owned handles/files:** Partial temp file, HTTP response.
**Cleanup responsibility:** Installer deletes partial temp file.
**Stable error class:** `InstallError::SizeMismatch`
**Retryability:** No; likely misconfiguration or attack.
**Test strategy:** Integration test with mock server sending oversized, undersized, and Content-Length-disagreeing responses.
**Unresolved limitation:** None.

### 7. Interrupted download

**Scenario:** Network connection drops during download.
**Expected state transition:** `Downloading → Interrupted → NotFound`
**Owned handles/files:** Partial temp file, HTTP response.
**Cleanup responsibility:** Installer deletes partial temp file.
**Stable error class:** `InstallError::DownloadInterrupted`
**Retryability:** Yes, with bounded backoff.
**Test strategy:** Integration test with mock server closing connection mid-stream.
**Unresolved limitation:** None.

### 8. Checksum mismatch

**Scenario:** Downloaded binary checksum does not match pinned SHA-256.
**Expected state transition:** `Downloaded → Verifying → ChecksumMismatch → NotFound`
**Owned handles/files:** Downloaded temp file.
**Cleanup responsibility:** Installer deletes mismatched temp file.
**Stable error class:** `InstallError::ChecksumMismatch`
**Retryability:** No; indicates tampering or misconfiguration.
**Test strategy:** Integration test with mock server serving corrupted binary.
**Unresolved limitation:** None.

### 9. Concurrent installation

**Scenario:** Two installer instances attempt to install simultaneously.
**Expected state transition:** `Discovering → LockAcquired → Promoting → PromotionCommitted → Discovered` (winner) or `Discovering → LockContention → Waiting → ReDiscovering → Discovered` (loser)
**Owned handles/files:** File lock on install directory.
**Cleanup responsibility:** Winner cleans temp file after commit. Loser waits for lock release, then re-discovers from authoritative state.
**Stable error class:** `InstallError::LockContention` (transient, not terminal)
**Retryability:** Loser waits and re-discovers; does not fail immediately.
**Test strategy:** Integration test spawning two installer tasks; verify loser re-discovers winner's result.
**Unresolved limitation:** File locking semantics vary across platforms.

### 10. Promotion failure and rollback

**Scenario:** Promotion from temp to final path fails (e.g., disk full, permission denied).
**Expected state transition:** `Verifying → PromotionAttempted → PromotionFailed → NotFound` (temp cleaned, no old version existed) or `Verifying → PromotionAttempted → PromotionFailed → Discovered(old_version)` (old preserved)
**Promotion order:** Lock must be acquired before promotion. New version must be fully verified before attempting to replace old. Old version is preserved until promotion commit succeeds.
**Owned handles/files:** Lock, temp file, old binary (if exists).
**Cleanup responsibility:** Installer deletes temp file on promotion failure. Old binary is preserved until new version is committed.
**Stable error class:** `InstallError::PromotionFailed`
**Retryability:** Yes, if transient (disk space freed).
**Test strategy:** Integration test with read-only target directory; verify old version preserved if exists.
**Unresolved limitation:** None.

### 11. Executable replacement after verification

**Scenario:** Existing binary is replaced with new verified version.
**Expected state transition:** `Discovered(old_version) → Verifying(new_version) → Promoting → PromotionCommitted → Discovered(new_version) → OldCleanup`
**Critical rule:** NEVER delete the old installation before the new one is fully present and verified. Preserve old until promotion commit succeeds.
**Owned handles/files:** Lock, old binary, new temp file.
**Cleanup responsibility:** Old binary is deleted only after new version promotion commit succeeds. If promotion fails, old binary is preserved.
**Stable error class:** `InstallError::ReplacementFailed`
**Retryability:** Yes, if transient.
**Test strategy:** Integration test with existing binary at managed path; verify old preserved on promotion failure.
**Unresolved limitation:** On Windows, cannot replace a running executable.

### 11b. TOCTOU protection during verify-to-spawn

**Scenario:** An attacker attempts to replace the verified executable between verification and CreateProcess.
**Mitigation:** Open the fully qualified executable path in the parent with access/share semantics that deny conflicting write/delete/replacement while allowing required read/execution behavior. Obtain and retain a stable file identity from that held parent handle. Hash and inspect the file through the held handle. Compare exact size, architecture, digest, and accepted Jcode identity. Keep the protective handle open in the parent throughout CreateProcess. Pass the same fully qualified path through lpApplicationName. Do not inherit the verification handle into the child unless a separate documented requirement exists. After process creation, re-check relevant file identity where meaningful and close the protective handle only when Windows image-loading semantics make replacement safe. Fail closed if the protective open cannot be established or identity changes. Keep residual path-resolution risk explicit until Windows adversarial evidence passes.

**Expected state transition:** `VerifiedHandleHeld → CreateProcessByFullyQualifiedPath → ProcessCreated → PostCreateIdentityCheck → ProtectiveHandleReleased`

**Owned handles/files:** Protective file handle (deny-write/delete sharing), process handle.
**Cleanup responsibility:** Protective file handle closed after post-creation identity check completes.
**Stable error class:** `InstallError::TOCTOUDetected` (if identity changes during verify-to-spawn)
**Retryability:** Yes, re-verify and re-open.
**Test strategy:** Integration tests for:
- Overwrite while the protective handle is held (should fail with sharing violation)
- Delete while held (should fail with sharing violation)
- Rename/replace while held (should fail with sharing violation)
- Hard-link alias replacement where applicable
- Replacement immediately before CreateProcess
- Replacement during CreateProcess
- Replacement immediately after CreateProcess returns
- Failure to obtain the required sharing/access mode (fail closed)

**Slice assignment:** Verification/managed-file protection evidence to Slice B. Final verified-spawn evidence to Slice C.
**Unresolved limitation:** If another process already holds a write handle, the deny-write open will fail; fail closed. Residual path-resolution risk remains explicit until Windows adversarial evidence passes.

### 11c. Installation interruption recovery

**Scenario:** Installation process is interrupted at various points (crash, power loss, user cancellation, system restart). The installer must recover safely on next startup without leaving the system in an inconsistent state or deleting the last known-good verified executable.

**Critical rule:** The installation lock must be acquired before interpreting or mutating recovery artifacts.

**Startup recovery states:**

| State | Final Executable | Staging | Rollback | Action |
|-------|------------------|---------|----------|--------|
| A | Valid | None | None | Return verified final; cleanup harmless stale untrusted residue only after ownership validation |
| B | Valid | Incomplete | None | Keep final; delete owned incomplete staging idempotently |
| C | Valid | None | Valid | Keep final after full validation; retain or remove rollback according to documented committed transaction state; never delete both |
| D | Missing/Invalid | None | Valid | Restore rollback atomically or retain as selected verified version; return Discovered(old_version) |
| E | Missing | Complete verified | None | Revalidate exact size, digest, architecture, identity, and artifact ownership; safely resume promotion under lock |
| F | Missing | Incomplete/untrusted | None | Delete owned staging idempotently; return NotFound and begin clean managed install |
| G | Invalid | Residue | Valid | Quarantine/remove invalid owned artifacts; restore verified rollback; never execute invalid final |
| H | Unknown/outside managed root | Any | Any | Do not delete or mutate; fail closed with stable recovery error where ownership cannot be proven |

**Interruption points:**
- During streaming (partial download)
- After staging flush but before verification
- After verification but before promotion
- After old-version preservation
- Between promotion rename operations
- After new final appears but before transaction commit marker/directory flush
- After commit but before rollback cleanup
- During cleanup

**Transaction markers:** Use deterministic artifact naming/state scheme to distinguish:
- Staging: `jcode-{version}-{arch}.staging`
- Rollback: `jcode-{version}-{arch}.rollback`
- Committed final: `jcode-{version}-{arch}.exe`
- Untrusted residue: any file not matching the above patterns or outside managed root

**Windows flush/durability research required:**
- File data flush: `FlushFileBuffers` on staging file before verification
- Metadata/directory durability: Windows does not guarantee directory entry durability across power loss; accept that restart recovery remains authoritative even if perfect durability cannot be achieved
- Rename/replace semantics: `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING` is atomic on NTFS within the same volume
- Restart recovery: Transaction markers and artifact naming are sufficient to distinguish state even without perfect durability guarantees

**Cleanup requirements:**
- Ownership-scoped: only delete artifacts that match the deterministic naming scheme and are inside the managed root
- Idempotent: safe to run multiple times with the same result
- Safe when repeated: never fails on already-cleaned state
- Cannot delete last known-good: rollback and final are never both deleted in the same operation

**Stable error class:** `InstallError::RecoveryFailed`
**Retryability:** Yes, recovery is idempotent and can be retried.
**Test strategy:** Integration and fault-injection tests for every interruption point:
- Kill process during streaming
- Kill process after staging flush but before verification
- Kill process after verification but before promotion
- Kill process after old-version preservation
- Kill process between promotion rename operations
- Kill process after new final appears but before commit marker
- Kill process after commit but before rollback cleanup
- Kill process during cleanup
- Power-loss simulation (unplug/ungraceful shutdown) for each state A-H

**Slice assignment:** Recovery flow design and evidence to Slice B. Fault-injection test evidence to Slice C.
**Unresolved limitation:** Windows directory entry durability across power loss is not guaranteed; recovery relies on transaction markers and artifact naming rather than perfect durability.

## Supervisor Scenarios

### 12. Shell-free spawn

**Scenario:** Spawn Jcode process without shell invocation.
**Expected state transition:** `Idle → Spawning → Spawned(pid, job_handle)`
**Owned handles/files:** Process handle, Job Object handle, stdin/stdout/stderr pipes.
**Cleanup responsibility:** Supervisor owns all handles, closes on drop.
**Stable error class:** `SupervisorError::SpawnFailed`
**Retryability:** Yes, if binary exists.
**Test strategy:** Unit test spawning a purpose-built Rust test-helper executable (`m2-test-helper`) with deterministic modes: exact argv capture, environment capture, simultaneous stdout/stderr, sleep/hang, controlled exit code, descendant creation, PID/handle liveness evidence. No shell (cmd.exe, PowerShell) is used as a test subject.
**Unresolved limitation:** None.

### 13. Environment allowlist

**Scenario:** Child process inherits only allowlisted environment variables.
**Expected state transition:** `Spawning → EnvironmentFiltered → Spawned`
**Owned handles/files:** Environment block.
**Cleanup responsibility:** None.
**Stable error class:** `SupervisorError::EnvironmentFilterFailed`
**Retryability:** No; configuration error.
**Test strategy:** Unit test verifying child receives only allowlisted vars.
**Unresolved limitation:** Some tools may require specific env vars not in allowlist.

### 14. Invalid workspace

**Scenario:** Working directory does not exist or is not a directory.
**Expected state transition:** `Spawning → WorkspaceInvalid → SpawnFailed`
**Owned handles/files:** None.
**Cleanup responsibility:** None.
**Stable error class:** `SupervisorError::InvalidWorkspace`
**Retryability:** No; user must provide valid workspace.
**Test strategy:** Unit test with non-existent workspace path.
**Unresolved limitation:** None.

### 15. Junction escape

**Scenario:** Workspace path contains a junction or symlink pointing outside allowed root.
**Expected state transition:** `Spawning → JunctionEscape → SpawnFailed`
**Owned handles/files:** None.
**Cleanup responsibility:** None.
**Stable error class:** `SupervisorError::PathEscape`
**Retryability:** No; security violation.
**Test strategy:** Unit test with workspace containing junction to parent.
**Unresolved limitation:** Junction detection requires platform-specific code.

### 16. Suspended child creation

**Scenario:** Create child process in suspended state, assign to Job Object, then resume.
**Expected state transition:** `Spawning → Suspended → JobAssigned → Resumed → Running`
**Owned handles/files:** Process handle (suspended), Job Object handle, thread handle.
**Cleanup responsibility:** Supervisor owns all handles; if Job assignment fails, terminate suspended process.
**Stable error class:** `SupervisorError::JobAssignmentFailed`
**Retryability:** No; terminate and retry spawn.
**Test strategy:** Unit test verifying child is assigned to Job before first instruction executes.
**Unresolved limitation:** Requires CREATE_SUSPENDED flag on Windows.

### 17. Job Object assignment failure

**Scenario:** AssignProcessToJobObject fails (e.g., process already in another Job with incompatible limits, or hierarchy conflict).
**Expected state transition:** `Suspended → JobAssignmentFailed → Terminated`
**Owned handles/files:** Suspended process handle.
**Cleanup responsibility:** Supervisor terminates suspended process safely.
**Stable error class:** `SupervisorError::JobAssignmentFailed`
**Retryability:** No; terminate and retry spawn.
**Test strategy:** Unit test with process already in a Job with incompatible limits.
**Windows Job Object nesting facts:** Nested Job Objects were introduced in Windows 8 and Windows Server 2012. The product target Windows 10/11 supports nesting. The real test requirement is behavior when Coding Studio itself already belongs to a Job Object (e.g., running under CI, a terminal multiplexer, or another supervisor). Assignment can still fail because of incompatible limits or hierarchy. The child must remain suspended and be terminated safely on assignment failure. No breakaway flag may be granted.
**Unresolved limitation:** Behavior when the parent process is already in a Job with restrictive limits needs Windows CI evidence.

### 18. Pipe inheritance failure

**Scenario:** Anonymous pipe creation or inheritance fails.
**Expected state transition:** `Spawning → PipeCreationFailed → SpawnFailed`
**Owned handles/files:** None.
**Cleanup responsibility:** Supervisor closes any partially created pipes.
**Stable error class:** `SupervisorError::PipeCreationFailed`
**Retryability:** Yes, if transient (handle exhaustion).
**Test strategy:** Unit test with exhausted handle table.
**Unresolved limitation:** None.

### 19. Simultaneous stdout/stderr pressure

**Scenario:** Child writes to both stdout and stderr at high rate.
**Expected state transition:** `Running → OutputPressure → BackpressureApplied → Running`
**Owned handles/files:** stdout pipe, stderr pipe, bounded channels.
**Cleanup responsibility:** Supervisor drains channels on exit.
**Stable error class:** `SupervisorError::OutputBackpressure`
**Retryability:** N/A; backpressure is normal operation.
**Test strategy:** Integration test with `m2-test-helper` writing to both streams at max rate in `simultaneous-output` mode.
**Frame policy:** MAX_FRAME_BYTES remains 4 MiB as accepted in Milestone One. A frame larger than 4 MiB is malformed. The preliminary queue model uses: maximum individual frame 4 MiB, small bounded item count, total queued bytes no greater than 8 MiB per process, backpressure before the byte budget is exceeded. Valid protocol events are never silently dropped. For sustained overload: apply backpressure, then fail the run explicitly with a stable resource-exhaustion error if progress cannot resume within a bounded deadline. Diagnostics may be truncated only after redaction and with an explicit truncation marker (`[truncated N bytes]`).
**Unresolved limitation:** None.

### 20. Cancellation during startup

**Scenario:** Cancellation signal arrives while child is spawning.
**Expected state transition:** `Spawning → Cancelling → Terminated`
**Owned handles/files:** Partial handles (process, Job, pipes).
**Cleanup responsibility:** Supervisor closes all handles, terminates if spawned.
**Stable error class:** `SupervisorError::Cancelled`
**Retryability:** No; cancellation is terminal.
**Test strategy:** Unit test cancelling spawn mid-operation.
**Unresolved limitation:** Race between spawn completion and cancellation.

### 21. Cancellation during output backpressure

**Scenario:** Cancellation signal arrives while output channel is full.
**Expected state transition:** `OutputPressure → Cancelling → Terminated`
**Owned handles/files:** Process handle, Job handle, pipes, channels.
**Cleanup responsibility:** Supervisor terminates process tree, drains channels, closes handles.
**Stable error class:** `SupervisorError::Cancelled`
**Retryability:** No; cancellation is terminal.
**Test strategy:** Integration test with child producing output and cancellation signal.
**Unresolved limitation:** None.

### 22. Child crash

**Scenario:** Child process exits with non-zero code or is terminated by signal.
**Expected state transition:** `Running → Crashed(exit_code) → Stopped`
**Owned handles/files:** Process handle (exited), Job handle.
**Cleanup responsibility:** Supervisor closes process handle.
**Stable error class:** `SupervisorError::ChildCrashed`
**Restart policy:** Restart is disabled by default. No crash automatically restarts unless an explicit trusted policy enables it. If enabled, retain a bounded attempt/window/backoff policy. Reset restart accounting only after a documented stability condition. Never restart integrity, identity, containment, workspace-validation, cancellation, or explicit user-stop failures. Classify retryability before applying restart policy. Exact numerical limits are preliminary until Slice D tests justify them.
**Test strategy:** Integration test with `m2-test-helper` in `exit <code>` mode.
**Unresolved limitation:** None.

### 23. Descendant escape attempt

**Scenario:** Child spawns a grandchild that attempts to escape the Job.
**Expected state transition:** `Running → EscapeDetected → (containment unproven)`
**Owned handles/files:** Job Object handle.
**Cleanup responsibility:** Job Object is the planned containment mechanism; KILL_ON_JOB_CLOSE and absence of breakaway permissions are planned controls.
**Stable error class:** `SupervisorError::DescendantEscape`
**Retryability:** No; security violation.
**Test strategy:** Integration test with `m2-test-helper` in `spawn-descendant` mode.
**Unresolved limitation:** Suspended creation plus Job assignment before resume is the planned design. Nested-host-Job behavior and descendant containment require Windows tests. Assignment or hierarchy incompatibility fails closed while the child remains suspended. Descendant containment remains unproven until Slice C evidence passes.

### 24. Restart storm

**Scenario:** Child crashes repeatedly in short time window.
**Expected state transition:** `Restarting → RestartStorm → Stopped`
**Owned handles/files:** None.
**Cleanup responsibility:** Supervisor stops restarting, logs storm.
**Stable error class:** `SupervisorError::RestartStorm`
**Restart policy:** Restart is disabled by default. If enabled, bounded attempt/window/backoff policy applies; stop and escalate on storm. Exact numerical limits are preliminary until Slice D tests justify them.
**Test strategy:** Integration test with `m2-test-helper` that crashes repeatedly.
**Unresolved limitation:** Threshold values need tuning based on Slice D evidence.

### 25. Cleanup failure

**Scenario:** Supervisor fails to clean up resources (e.g., cannot delete temp file).
**Expected state transition:** `Terminated → CleanupFailed → Stopped`
**Owned handles/files:** Orphaned temp file or handle.
**Cleanup responsibility:** Supervisor logs failure, cannot retry.
**Stable error class:** `SupervisorError::CleanupFailed`
**Retryability:** No; manual intervention required.
**Test strategy:** Unit test with read-only temp directory.
**Unresolved limitation:** Orphaned resources may accumulate over time.

## Summary

Twenty-five scenarios rehearsed. All have explicit state transitions, owned
resources, cleanup responsibility, error classes, retryability, and test
strategies. Unresolved limitations are documented and will be addressed in
implementation or deferred to future milestones.

## Lifecycle Timeout Model

The supervisor does not terminate a healthy long-lived Jcode process
merely because stdout/stderr is quiet. User inactivity is not process
failure. Separate bounded timeouts apply to specific lifecycle phases:

| Phase | Timeout | Error Class |
|-------|---------|-------------|
| Process creation | 30s | `SupervisorError::SpawnTimeout` |
| Identity probe | 10s | `SupervisorError::IdentityProbeTimeout` |
| Protocol handshake | 15s | `SupervisorError::HandshakeTimeout` |
| Tracked operation | Per-operation | `SupervisorError::OperationTimeout` |
| Graceful shutdown | 5s | `SupervisorError::ShutdownTimeout` |
| Forced cleanup | 3s | `SupervisorError::CleanupTimeout` |

**Test strategy:** Use `m2-test-helper` in `sleep` and `hang` modes to
verify each phase-specific timeout independently.

## Test Helper Design

All supervisor tests use a purpose-built Rust test-helper executable
(`m2-test-helper`) instead of shell commands. The helper supports
deterministic modes:

- `argv-capture` — print exact argv as JSON
- `env-capture` — print exact environment as JSON
- `simultaneous-output` — write to both stdout and stderr at high rate
- `sleep <seconds>` — sleep for N seconds then exit 0
- `hang` — block indefinitely (for shutdown testing)
- `exit <code>` — exit with specific code
- `spawn-descendant` — spawn a child process that outlives the helper
- `liveness` — print PID and handle liveness evidence

No shell (cmd.exe, PowerShell) is used as a production supervisor test
subject.
