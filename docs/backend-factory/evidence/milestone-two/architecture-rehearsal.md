# Milestone Two Architecture Rehearsal

This document rehearses failure scenarios for the managed installer and
process supervisor before implementation. Each scenario records the expected
state transition, owned handles and files, cleanup responsibility, stable
error class, retryability, test strategy, and unresolved limitations.

## Installer Scenarios

### 1. Explicit binary discovery

**Scenario:** Jcode binary already exists at the managed path and matches the pinned version.
**Expected state transition:** `Idle → Discovering → Discovered(version) → Idle`
**Owned handles/files:** Read access to binary path, version query handle.
**Cleanup responsibility:** None.
**Stable error class:** `InstallError::VersionQueryFailed`
**Retryability:** Yes, on transient I/O errors.
**Test strategy:** Unit test with fixture binary at managed path.
**Unresolved limitation:** None.

### 2. Managed install discovery

**Scenario:** No binary found; managed install initiates download and installation.
**Expected state transition:** `Idle → Discovering → NotFound → Downloading → Verifying → Promoting → Discovered(version) → Idle`
**Owned handles/files:** Download temp file, final binary path, HTTP response handle.
**Cleanup responsibility:** Installer cleans temp file on any failure.
**Stable error class:** `InstallError::DownloadFailed`, `InstallError::ChecksumMismatch`, `InstallError::PromotionFailed`
**Retryability:** Download retryable (transient); checksum mismatch not retryable.
**Test strategy:** Integration test with mock HTTP server.
**Unresolved limitation:** None.

### 3. Untrusted PATH candidate

**Scenario:** Binary found on PATH but not at the managed location.
**Expected state transition:** `Idle → Discovering → UntrustedPathCandidate → Rejected → NotFound → ...`
**Owned handles/files:** None.
**Cleanup responsibility:** None.
**Stable error class:** `InstallError::UntrustedPath`
**Retryability:** No; triggers managed install instead.
**Test strategy:** Unit test with PATH containing non-managed binary.
**Unresolved limitation:** User may have a valid system-installed Jcode; policy rejects it for security.

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

**Scenario:** Download exceeds maximum allowed size (e.g., 500 MB).
**Expected state transition:** `Downloading → SizeExceeded → NotFound`
**Owned handles/files:** Partial temp file, HTTP response.
**Cleanup responsibility:** Installer deletes partial temp file.
**Stable error class:** `InstallError::SizeExceeded`
**Retryability:** No; likely misconfiguration or attack.
**Test strategy:** Integration test with mock server sending oversized response.
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
**Expected state transition:** `Promoting → LockContention → PromotionFailed → NotFound`
**Owned handles/files:** File lock on install directory.
**Cleanup responsibility:** Loser releases lock and cleans temp file.
**Stable error class:** `InstallError::LockContention`
**Retryability:** Yes, with backoff.
**Test strategy:** Integration test spawning two installer tasks.
**Unresolved limitation:** File locking semantics vary across platforms.

### 10. Promotion failure and rollback

**Scenario:** Atomic rename from temp to final path fails (e.g., disk full).
**Expected state transition:** `Promoting → PromotionFailed → NotFound`
**Owned handles/files:** Temp file, final path.
**Cleanup responsibility:** Installer deletes temp file.
**Stable error class:** `InstallError::PromotionFailed`
**Retryability:** Yes, if transient (disk space freed).
**Test strategy:** Integration test with read-only target directory.
**Unresolved limitation:** None.

### 11. Executable replacement after verification

**Scenario:** Existing binary is replaced with new verified version.
**Expected state transition:** `Discovered(old_version) → Replacing → Discovered(new_version)`
**Owned handles/files:** Old binary, new temp file.
**Cleanup responsibility:** Installer deletes old binary after successful rename.
**Stable error class:** `InstallError::ReplacementFailed`
**Retryability:** Yes, if transient.
**Test strategy:** Integration test with existing binary at managed path.
**Unresolved limitation:** On Windows, cannot replace a running executable.

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
**Expected state transition:** `Running → Crashed(exit_code) → Restarting`
**Owned handles/files:** Process handle (exited), Job handle.
**Cleanup responsibility:** Supervisor closes process handle, retains Job for restart.
**Stable error class:** `SupervisorError::ChildCrashed`
**Retryability:** Yes, with backoff (up to 5 restarts in 60 seconds).
**Test strategy:** Integration test with child that exits immediately.
**Unresolved limitation:** None.

### 23. Descendant escape attempt

**Scenario:** Child spawns a grandchild that attempts to escape the Job.
**Expected state transition:** `Running → EscapeBlocked → Running`
**Owned handles/files:** Job Object (blocks escape).
**Cleanup responsibility:** Job Object enforces containment.
**Stable error class:** N/A; escape is blocked by Job Object.
**Retryability:** N/A.
**Test strategy:** Integration test with child spawning grandchild that attempts breakaway.
**Unresolved limitation:** Requires JOB_OBJECT_LIMIT_BREAKAWAY_OK to be unset.

### 24. Restart storm

**Scenario:** Child crashes repeatedly in short time window.
**Expected state transition:** `Restarting → RestartStorm → Stopped`
**Owned handles/files:** None.
**Cleanup responsibility:** Supervisor stops restarting, logs storm.
**Stable error class:** `SupervisorError::RestartStorm`
**Retryability:** No; escalation required.
**Test strategy:** Integration test with child that crashes 5 times in 60 seconds.
**Unresolved limitation:** Threshold (5 in 60s) may need tuning.

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
