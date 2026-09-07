# Milestone Two Resource Bounds

This document proposes preliminary resource limits for Milestone Two. All
values are preliminary and subject to revision based on implementation
experience and testing.

## Target Environment

- 16 GB system RAM
- 4 GB GPU VRAM
- Windows 10/11 desktop
- No local inference or GPU process may be started

## Download Limits

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| Maximum download bytes (x86_64) | 128476672 bytes | Exact accepted architecture-specific executable size from Milestone One |
| Maximum download bytes (ARM64) | 80173056 bytes | Exact accepted architecture-specific executable size from Milestone One |
| Content-Length validation | Reject disagreement when present | When Content-Length header is present, reject if it disagrees with the expected architecture-specific size |
| Byte counting | Count actual bytes regardless of Content-Length | Actual byte count is authoritative |
| Extra/missing bytes | Reject any extra or missing byte | No tolerance for size deviation |
| Checksum verification | After exact byte-count validation | SHA-256 verified only after byte count matches expected |
| Download retry attempts | 3 | Bounded retry prevents infinite loops |
| Download retry backoff | 1s, 2s, 4s | Exponential backoff with small base |

### Timeout Accounting

Download timeouts use a coherent model where connect and read-progress
timeouts are sub-deadlines inside the per-attempt ceiling:

| Phase | Timeout | Rationale |
|-------|---------|-----------|
| Connect timeout | 30 seconds | TCP/TLS handshake sub-deadline (included in per-attempt ceiling) |
| Read-progress/stall timeout | 60 seconds | If no bytes received for 60 seconds, consider stalled (included in per-attempt ceiling) |
| Per-attempt ceiling | 300 seconds | Single download attempt including connect + transfer should not exceed 5 minutes |
| Aggregate retry ceiling | 907 seconds | Total across 3 attempts: 3 × 300s + 1s + 2s + 4s backoff = 907s maximum |

Retries must not multiply into an undocumented total duration. The
aggregate ceiling is the deliberate total installation time bound.
Slice B must include one deterministic clock-controlled test for the
aggregate deadline.

### Peak Disk Analysis

Peak disk usage during installation includes:

| Component | Size (x86_64) | Size (ARM64) |
|-----------|---------------|--------------|
| Existing verified version | ~122 MiB | ~76 MiB |
| Staging file (download in progress) | ~122 MiB | ~76 MiB |
| Promoted version or rollback copy | ~122 MiB | ~76 MiB |
| Bounded cleanup residue | ≤1 MiB | ≤1 MiB |
| **Peak total** | **~367 MiB** | **~229 MiB** |

Available-space preflight is advisory because the write itself remains
authoritative. The installer must not claim a system has any specific
amount of free disk.

## Timeout Limits

The supervisor does not terminate a healthy long-lived Jcode process
merely because stdout/stderr is quiet. User inactivity is not process
failure. Separate bounded timeouts apply to specific lifecycle phases:

| Phase | Timeout | Rationale |
|-------|---------|-----------|
| Process creation | 30 seconds | Process should start within 30 seconds or fail |
| Identity probe | 10 seconds | Jcode should respond to version/identity query within 10 seconds |
| Protocol handshake | 15 seconds | Initial protocol negotiation should complete within 15 seconds |
| Tracked operation | Per-operation | When the protocol supports explicit operation tracking, apply per-operation timeouts |
| Graceful shutdown | 5 seconds | Allow graceful shutdown before forced termination |
| Forced cleanup | 3 seconds | Force-terminate after graceful timeout expires |

No generic idle timeout is applied. A process that is waiting for user
input or performing a long computation without producing output is not
considered failed.

## Output Buffer Limits

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| Maximum frame size | 4 MiB | Preserved from Milestone One MAX_FRAME_BYTES; a frame larger than 4 MiB is malformed |
| Total queued bytes (per process) | 8 MiB | Bounded total across stdout and stderr channels |
| Queue item count | 16 | Small bounded item count; 16 frames at up to 4 MiB each, capped by 8 MiB total |
| Retained stderr bytes | 256 KiB | Retain recent stderr for diagnostics; older output dropped with explicit truncation marker |
| Diagnostic line length | 4 KiB | Single stderr line should not exceed 4 KiB; longer lines truncated with `[truncated N bytes]` marker after redaction |

## Protocol Limits

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| Malformed frame threshold | 10 | After 10 consecutive malformed frames, terminate child as likely protocol violation |

**No message-rate limit.** Valid protocol events are never silently
dropped because of a rate threshold. For sustained overload: apply
backpressure, then fail the run explicitly with a stable
resource-exhaustion error if progress cannot resume within a bounded
deadline.

## Restart Limits

Restart is disabled by default. No crash automatically restarts unless an
explicit trusted policy enables it. If enabled, the following preliminary
limits apply:

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| Restart policy | Disabled by default | No automatic restart unless explicitly enabled by trusted policy |
| Restart attempts | Preliminary: 5 | Maximum 5 restarts before stopping (if enabled) |
| Restart window | Preliminary: 60 seconds | Count restarts within 60-second window (if enabled) |
| Restart backoff | Preliminary: 1s, 2s, 4s, 8s, 16s | Exponential backoff prevents restart storm (if enabled) |
| Stability reset | Documented condition | Reset restart accounting only after a documented stability condition |
| Non-restartable failures | Integrity, identity, containment, workspace-validation, cancellation, explicit user-stop | Never restart these failure classes |
| Retryability classification | Before restart | Classify retryability before applying restart policy |

Exact numerical limits are preliminary until Slice D tests justify them.

## Memory Budget Analysis

**Goal:** Do not accept a design that can retain 256 MiB per child merely from 64 maximum-sized frames.

**Analysis:**
- Maximum frame size: 4 MiB (preserved from M1)
- Queue item count: 16 frames
- Total queued bytes cap: 8 MiB
- Effective maximum: min(16 × 4 MiB, 8 MiB) = 8 MiB

**Result:** 8 MiB per child, not 256 MiB. Budget is respected.

### Stream Model

- M1 FrameDecoder applies to structured stdout protocol frames.
- stderr is a separate bounded raw diagnostic stream (ring buffer, not framed).
- The preliminary design does not assume two independent 4 MiB FrameDecoder instances unless the actual protocol proves both streams are framed.

### Category A: Strictly Budgeted Encoded Payload Ownership

| Component | Budget | Notes |
|-----------|--------|-------|
| FrameDecoder accumulation (stdout) | ≤4 MiB | Single stream; one max-frame accumulation buffer |
| Queued encoded/decoded event permits | ≤8 MiB total | 8 MiB payload permit across all queues |
| In-flight event permit | ≤4 MiB | One frame being processed at a time |
| Raw stderr ring | ≤256 KiB | Bounded diagnostic ring buffer |
| Read chunks | Bounded | Implementation-defined, bounded by pipe read size |

**8 MiB payload permit semantics:**
- Permits are charged by original encoded frame length
- Permit is acquired when a frame is decoded and queued for delivery
- Ownership transfer avoids double charging (permit follows the frame)
- Permit is released when the frame is consumed by the upstream reader
- A single 4 MiB frame can be accepted without violating the 8 MiB total budget because the permit tracks actual encoded size, not worst-case capacity

### Category B: Runtime and Representation Overhead (not yet budgeted)

| Component | Status | Notes |
|-----------|--------|-------|
| Vec/String capacities | Not budgeted | Depends on implementation |
| serde/StudioEvent decoded object expansion | Not budgeted | JSON can expand significantly |
| Channel metadata | Not budgeted | Bounded but implementation-specific |
| Allocator fragmentation | Not budgeted | Platform-specific |
| Task or thread stacks | Not budgeted | Depends on runtime choice |
| OS pipe/kernel allocations | Not budgeted | Kernel-owned, not user-space retained |
| Process/Job/handle metadata | Not budgeted | Small but implementation-specific |

**OS pipe buffers** are kernel-owned allocations. Do not include them
in the user-space retained payload ceiling unless the implementation
explicitly requests, verifies, and accounts for the effective value.
Treat kernel pipe allocation separately from user-space retained payload
memory.

### Preliminary Supervisor-Owned Buffer Estimate

**Preliminary encoded-payload/buffer budget estimate per process:**
- stdout FrameDecoder accumulation: ≤4 MiB
- Queued encoded event permits: ≤8 MiB
- In-flight event permit: ≤4 MiB
- Raw stderr ring: ≤256 KiB
- **Preliminary total:** ~16.25 MiB

This is a preliminary supervisor-owned buffer estimate, not a complete
conservative upper bound. It covers Category A (encoded payload ownership)
only. Category B (runtime/representation overhead) is not yet budgeted.

**System-wide:**
- Maximum concurrent processes: 1
- **Preliminary encoded-payload/buffer estimate:** ~16.25 MiB

This is well within the 16 GB system RAM target (~0.1% of available RAM).

### Implementation Acceptance Target for Decoded/Runtime Overhead

Slice D must measure peak supervisor overhead on Windows and justify a
final ceiling. The following adversarial cases must be tested:

- Adversarial maximum-size valid JSON frame (4 MiB encoded, potentially larger decoded)
- Many-small-fields JSON expansion case (many small objects that expand in memory)
- Maximum queue occupancy (all 8 MiB of permits consumed simultaneously)
- Simultaneous stderr pressure (stderr ring full while stdout is also full)
- Cancellation while full (cancellation during peak memory usage)
- Repeated runs to expose allocator retention (memory growth over time)

The research document may propose a provisional acceptance target, but
must not claim it is mathematically guaranteed before measurement.

**Slice assignment:** Memory evidence belongs primarily to Slice D, not Slice C.

## CPU Budget Analysis

**Goal:** No local inference or GPU process may be started.

**Analysis:**
- Jcode is a CLI tool that delegates to remote AI providers
- No local model loading or inference
- CPU usage is limited to:
  - Process spawning and management
  - I/O streaming and buffering
  - Protocol parsing and validation
  - Checksum verification (SHA-256)

**Result:** CPU usage is minimal and bounded by I/O and network speed, not computation.

## GPU Budget Analysis

**Goal:** 4 GB GPU VRAM preserved for user applications.

**Analysis:**
- Milestone Two does not start any GPU process
- No CUDA, DirectML, or other GPU API is invoked
- Jcode delegates inference to remote providers

**Result:** GPU VRAM usage is zero. 4 GB preserved for user applications.

## Rejected Designs

### Design 1: Unbounded output buffer

**Proposal:** Buffer all child output in memory for later processing.
**Rejected:** Could retain gigabytes of output, exhausting RAM.
**Mitigation:** Use bounded channels with backpressure; total queued bytes capped at 8 MiB.

### Design 2: 64 frames × 4 MiB each

**Proposal:** Allow 64 frames of up to 4 MiB each.
**Rejected:** 64 × 4 MiB = 256 MiB, violates resource budget.
**Mitigation:** Limit total queued bytes to 8 MiB regardless of frame count.

### Design 3: Automatic restart on crash

**Proposal:** Restart child automatically on any crash.
**Rejected:** Could cause restart storm, exhausting CPU and I/O. Restarts on integrity, identity, containment, or cancellation failures are unsafe.
**Mitigation:** Restart is disabled by default. If enabled by explicit trusted policy, apply bounded attempt/window/backoff with retryability classification. Never restart integrity, identity, containment, workspace-validation, cancellation, or explicit user-stop failures.

### Design 4: Serial blocking drain of stdout/stderr

**Proposal:** Read stdout and stderr sequentially using blocking I/O on the async runtime thread.
**Rejected:** Serial blocking drain creates deadlock risk when multiple streams are read sequentially (one stream can fill its buffer while the other is not being read). Blocks async runtime, poor scalability.
**Mitigation:** Use async readers for both streams concurrently, OR use dedicated bounded reader threads with explicit cancellation/join cleanup, OR an eventual runtime-provided blocking-task facility if an async runtime is selected. Never drain streams serially on the async runtime thread.

### Design 5: Generic idle timeout

**Proposal:** Terminate child if no output for N minutes.
**Rejected:** User inactivity is not process failure. A process waiting for user input or performing a long computation without producing output is healthy.
**Mitigation:** Define separate bounded timeouts for specific lifecycle phases (creation, identity probe, handshake, tracked operation, shutdown, cleanup). No generic idle timeout.

### Design 6: Generic 500 MiB download allowance

**Proposal:** Allow up to 500 MiB for any download.
**Rejected:** Far exceeds the actual executable size; allows disk exhaustion from a compromised or misconfigured server.
**Mitigation:** Use exact architecture-specific sizes (x86_64: 128476672 bytes, ARM64: 80173056 bytes). Reject any extra or missing byte.

### Design 7: Message-rate limit with silent drop

**Proposal:** Drop protocol messages exceeding a rate threshold.
**Rejected:** Silently dropping valid protocol events can corrupt the protocol state machine.
**Mitigation:** Apply backpressure, then fail explicitly with a stable resource-exhaustion error if progress cannot resume.

## Preliminary Status

All proposed limits are preliminary and subject to revision based on:
- Implementation experience
- Testing results
- User feedback
- Performance measurements

Limit finalization ownership by slice:
- Installer bounds (download sizes, timeouts, disk accounting) in Slice B
- Supervisor/process bounds (spawn, Job Object, path validation) in Slices C and D
- Stream/lifecycle/restart bounds in Slice D
- Final confirmation in Slice E

## Conclusion

Resource bounds are proposed for all Milestone Two operations. The design
respects the 16 GB RAM and 4 GB GPU VRAM targets. No design retains
256 MiB per child. Frame policy preserves M1 MAX_FRAME_BYTES = 4 MiB.
Total queued bytes capped at 8 MiB. No generic idle timeout. Download
bounds use exact architecture-specific sizes. Valid protocol events are
never silently dropped.
