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
| Download timeout | 300 seconds | 5 minutes for ~122 MiB at ~400 KiB/s; reasonable for broadband connections |
| Download retry attempts | 3 | Bounded retry prevents infinite loops |
| Download retry backoff | 1s, 2s, 4s | Exponential backoff with small base |
| Content-Length validation | Reject disagreement when present | When Content-Length header is present, reject if it disagrees with the expected architecture-specific size |
| Byte counting | Count actual bytes regardless of Content-Length | Actual byte count is authoritative |
| Extra/missing bytes | Reject any extra or missing byte | No tolerance for size deviation |
| Checksum verification | After exact byte-count validation | SHA-256 verified only after byte count matches expected |

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

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| Restart attempts | 5 | Maximum 5 restarts before stopping |
| Restart window | 60 seconds | Count restarts within 60-second window |
| Restart backoff | 1s, 2s, 4s, 8s, 16s | Exponential backoff prevents restart storm |

## Memory Budget Analysis

**Goal:** Do not accept a design that can retain 256 MiB per child merely from 64 maximum-sized frames.

**Analysis:**
- Maximum frame size: 4 MiB (preserved from M1)
- Queue item count: 16 frames
- Total queued bytes cap: 8 MiB
- Effective maximum: min(16 × 4 MiB, 8 MiB) = 8 MiB

**Result:** 8 MiB per child, not 256 MiB. Budget is respected.

**Breakdown per managed process:**
- stdout/stderr channels (capped): 8 MiB
- Retained stderr: 256 KiB
- Process metadata: ~1 KiB
- **Total per process:** ~8.25 MiB

**System-wide:**
- Maximum concurrent processes: 1
- **Total memory overhead:** ~8.25 MiB

This is well within the 16 GB system RAM target (0.05% of available RAM).

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

### Design 3: No restart limit

**Proposal:** Restart child indefinitely on crash.
**Rejected:** Could cause restart storm, exhausting CPU and I/O.
**Mitigation:** Limit to 5 restarts in 60 seconds.

### Design 4: Synchronous I/O

**Proposal:** Use blocking I/O for simplicity.
**Rejected:** Blocks async runtime, poor scalability, deadlock risk with multiple streams.
**Mitigation:** Use async I/O.

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

Limits will be finalized in Slice B after implementation and testing.

## Conclusion

Resource bounds are proposed for all Milestone Two operations. The design
respects the 16 GB RAM and 4 GB GPU VRAM targets. No design retains
256 MiB per child. Frame policy preserves M1 MAX_FRAME_BYTES = 4 MiB.
Total queued bytes capped at 8 MiB. No generic idle timeout. Download
bounds use exact architecture-specific sizes. Valid protocol events are
never silently dropped.
