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
| Maximum download bytes | 500 MiB | Jcode binary is ~50-100 MiB; 500 MiB provides headroom for future growth while preventing disk exhaustion |
| Download timeout | 300 seconds | 5 minutes for 500 MiB at ~1.7 MiB/s; reasonable for broadband connections |
| Download retry attempts | 3 | Bounded retry prevents infinite loops |
| Download retry backoff | 1s, 2s, 4s | Exponential backoff with small base |

## Process Limits

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| Maximum concurrent managed processes | 1 | Milestone Two manages a single Jcode instance; multiple instances deferred to future milestone |
| Spawn timeout | 30 seconds | Process should start within 30 seconds or fail |
| Idle timeout | 300 seconds | Terminate process if no activity for 5 minutes |
| Shutdown grace period | 5 seconds | Allow graceful shutdown before forced termination |

## Output Buffer Limits

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| Maximum frame size | 64 KiB | Single NDJSON frame should not exceed 64 KiB; larger frames indicate malformed protocol |
| Total queued bytes (stdout) | 4 MiB | Bounded channel prevents memory exhaustion; 4 MiB = 64 frames at max size |
| Total queued bytes (stderr) | 1 MiB | Stderr is diagnostic; smaller buffer acceptable |
| Queue item count | 64 | Maximum frames in channel before backpressure |
| Retained stderr bytes | 256 KiB | Retain recent stderr for diagnostics; older output dropped |
| Diagnostic line length | 4 KiB | Single stderr line should not exceed 4 KiB; longer lines truncated |

## Protocol Limits

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| Malformed frame threshold | 10 | After 10 consecutive malformed frames, terminate child as likely protocol violation |
| Message rate limit | 100 messages/second | Prevent protocol flood; drop messages exceeding rate |

## Restart Limits

| Parameter | Proposed Value | Rationale |
|-----------|---------------|-----------|
| Restart attempts | 5 | Maximum 5 restarts before stopping |
| Restart window | 60 seconds | Count restarts within 60-second window |
| Restart backoff | 1s, 2s, 4s, 8s, 16s | Exponential backoff prevents restart storm |

## Memory Budget Analysis

**Goal:** Do not accept a design that can retain 256 MiB per child merely from 64 maximum-sized frames.

**Analysis:**
- Maximum frame size: 64 KiB
- Queue item count: 64 frames
- Total queued bytes: 64 × 64 KiB = 4 MiB

**Result:** 4 MiB per child, not 256 MiB. Budget is respected.

**Breakdown per managed process:**
- stdout channel: 4 MiB
- stderr channel: 1 MiB
- Retained stderr: 256 KiB
- Process metadata: ~1 KiB
- **Total per process:** ~5.25 MiB

**System-wide:**
- Maximum concurrent processes: 1
- **Total memory overhead:** ~5.25 MiB

This is well within the 16 GB system RAM target (0.03% of available RAM).

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

## Disk Budget Analysis

**Goal:** Prevent disk exhaustion from downloads and installations.

**Analysis:**
- Maximum download size: 500 MiB
- Temporary file during download: 500 MiB
- Final installation: ~100 MiB (typical Jcode binary)
- **Peak disk usage:** 600 MiB (temp + final during promotion)

**Result:** 600 MiB is reasonable for a desktop system with 100+ GB free space.

## Network Budget Analysis

**Goal:** Prevent network exhaustion from downloads.

**Analysis:**
- Maximum download size: 500 MiB
- Download timeout: 300 seconds
- **Minimum bandwidth:** 500 MiB / 300 s = 1.67 MiB/s

**Result:** 1.67 MiB/s is reasonable for broadband connections. Slower connections will timeout and retry.

## Rejected Designs

### Design 1: Unbounded output buffer

**Proposal:** Buffer all child output in memory for later processing.
**Rejected:** Could retain gigabytes of output, exhausting RAM.
**Mitigation:** Use bounded channels with backpressure.

### Design 2: 64 frames × 4 MiB each

**Proposal:** Allow 64 frames of up to 4 MiB each.
**Rejected:** 64 × 4 MiB = 256 MiB, violates resource budget.
**Mitigation:** Limit frame size to 64 KiB, total queue to 4 MiB.

### Design 3: No restart limit

**Proposal:** Restart child indefinitely on crash.
**Rejected:** Could cause restart storm, exhausting CPU and I/O.
**Mitigation:** Limit to 5 restarts in 60 seconds.

### Design 4: Synchronous I/O

**Proposal:** Use blocking I/O for simplicity.
**Rejected:** Blocks async runtime, poor scalability, deadlock risk with multiple streams.
**Mitigation:** Use async I/O with tokio.

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
256 MiB per child from 64 maximum-sized frames. All limits are preliminary
and will be finalized after implementation and testing.
