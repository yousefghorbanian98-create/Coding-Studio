# Milestone Two Security Review

This document records the threat model for Milestone Two: managed Jcode
installation and Windows process supervisor. Each threat records a status:
planned mitigation, evidence required, accepted limitation, blocked, or not
applicable. No mitigation is claimed to exist before implementation.

## Installation Threats

### THR-M2-001: Release substitution

**Description:** An attacker substitutes the Jcode binary at the download URL with a malicious version.
**Status:** Planned mitigation — verify SHA-256 of the downloaded executable bytes against the Coding Studio trust anchor: the exact architecture-specific digest accepted and recorded in Milestone One. The GitHub release asset, co-located SHA256SUMS file, and GitHub API metadata are useful corroborating observations but remain inside the GitHub/upstream trust domain and are not independent trust channels.
**Evidence required:** Integration test with mock server serving substituted binary; checksum verification against the M1-accepted anchor rejects it.

### THR-M2-002: Checksum substitution

**Description:** An attacker compromises both the binary and the checksum file, making verification pass.
**Status:** Planned mitigation — the Coding Studio trust anchor is the exact architecture-specific executable SHA-256 digest accepted in Milestone One, not a co-located checksum file. The GitHub API digest and SHA256SUMS are corroborating observations inside the GitHub trust domain; they may be compared as additional signals but never replace the M1-accepted anchor.
**Evidence required:** Verify that the installer rejects any binary whose SHA-256 does not match the M1-accepted anchor, regardless of what the GitHub API or SHA256SUMS report.

### THR-M2-003: Mutable release assets

**Description:** Upstream replaces a release asset without changing the version tag, invalidating pinned checksums.
**Status:** Planned mitigation — pin to a specific release asset ID or commit SHA, not a mutable tag.
**Evidence required:** Verify pin survives upstream asset replacement.

### THR-M2-004: Redirect abuse

**Description:** Download URL redirects to an unauthorized host serving a malicious binary.
**Status:** Planned mitigation — restrict redirects to an allowlist of trusted hosts; reject unauthorized redirects.
**Evidence required:** Unit test with redirect to unauthorized host.

### THR-M2-005: Partial download

**Description:** Download is interrupted, leaving a partial binary that passes checksum if only partial bytes are hashed.
**Status:** Planned mitigation — verify checksum only after complete download; reject partial downloads.
**Evidence required:** Integration test with interrupted download.

### THR-M2-006: Oversized download

**Description:** Download exceeds expected size, exhausting disk or memory.
**Status:** Planned mitigation — enforce maximum download size; abort and clean up on exceedance.
**Evidence required:** Integration test with oversized response.

### THR-M2-007: Disk exhaustion

**Description:** Installation fills disk, causing system instability.
**Status:** Planned mitigation — check available disk space before download; enforce reasonable size limits.
**Evidence required:** Unit test with mocked low-disk-space condition.

### THR-M2-008: Concurrent installers

**Description:** Two installer instances race, corrupting the installation.
**Status:** Planned mitigation — use file locking or atomic rename to serialize installation.
**Evidence required:** Integration test spawning concurrent installers.

### THR-M2-009: TOCTOU replacement

**Description:** Binary is replaced between checksum verification and execution.
**Status:** Planned mitigation — verify checksum immediately before execution; use file handle from verification.
**Evidence required:** Unit test with TOCTOU race scenario.

### THR-M2-010: Path traversal

**Description:** Installation path contains `..` or other traversal, writing outside intended directory.
**Status:** Planned mitigation — canonicalize and validate installation path; reject paths outside managed root.
**Evidence required:** Unit test with traversal attempts.

### THR-M2-011: Symlink/junction/reparse escape

**Description:** Installation path contains a symlink or junction pointing outside the managed root.
**Status:** Planned mitigation — detect and reject symlinks, junctions, and reparse points in installation path.
**Evidence required:** Unit test with junction pointing to parent directory.

### THR-M2-012: Unsafe temporary paths

**Description:** Temporary download file is created in a world-writable directory, allowing substitution.
**Status:** Planned mitigation — create temp file in a secure, user-owned directory with restrictive permissions.
**Evidence required:** Unit test verifying temp file permissions.

### THR-M2-013: DLL search hijacking

**Description:** Malicious DLL is placed in a directory in the child's DLL search path, loaded by Jcode at startup.
**Status:** Planned mitigation — use fully qualified executable path; set controlled child working directory; sanitize or omit inherited PATH where feasible; ensure no untrusted writable directory is in the child DLL search path. Evaluate child-specific process mitigation and loader behavior from Microsoft primary documentation (SetDefaultDllDirectories, LOAD_LIBRARY_SEARCH_SYSTEM32). Do not mutate the parent Coding Studio process-wide DLL search state (e.g., SetDllDirectory) as an incidental spawn operation.
**Evidence required:** Windows CI evidence that the child process does not load DLLs from untrusted directories.
**Accepted limitation:** Residual DLL dependency-loading risk remains explicit until implementation and Windows evidence exist. Cannot prevent all DLL hijacking vectors; mitigate known high-risk paths.

## Supervisor Threats

### THR-M2-014: Shell and argument injection

**Description:** Child process is spawned via shell, allowing command injection through arguments.
**Status:** Planned mitigation — spawn process directly without shell; validate and escape arguments.
**Evidence required:** Unit test with shell metacharacters in arguments.

### THR-M2-015: Credential and proxy leakage

**Description:** Child process inherits environment variables containing credentials or proxy settings.
**Status:** Planned mitigation — filter environment to allowlist; do not inherit credentials.
**Evidence required:** Unit test verifying child does not receive credentials.

### THR-M2-016: Process escape before containment

**Description:** Child process executes code before being assigned to Job Object, allowing escape.
**Status:** Planned mitigation — create process suspended, assign to Job Object, then resume.
**Evidence required:** Unit test verifying Job assignment before first instruction.

### THR-M2-017: Orphan descendants

**Description:** Child spawns descendants that survive parent termination.
**Status:** Planned mitigation — use Job Object with KILL_ON_JOB_CLOSE to terminate entire tree.
**Evidence required:** Integration test with child spawning long-running grandchild.

### THR-M2-018: PID reuse

**Description:** Supervisor tracks child by PID, but PID is reused after child exits, targeting wrong process.
**Status:** Planned mitigation — track child by handle, not PID; use handle-based operations.
**Evidence required:** Unit test verifying handle-based tracking.

### THR-M2-019: stdout/stderr deadlock

**Description:** Child writes to stdout and stderr; supervisor reads only one, causing deadlock.
**Status:** Planned mitigation — read both streams concurrently using async tasks or threads.
**Evidence required:** Integration test with child writing to both streams at high rate.

### THR-M2-020: Unbounded output

**Description:** Child produces output faster than supervisor can consume, exhausting memory.
**Status:** Planned mitigation — use bounded channels with backpressure; drop or truncate output on overflow.
**Evidence required:** Integration test with child producing output at max rate.

### THR-M2-021: Malformed protocol flood

**Description:** Child sends malformed or excessive protocol messages, overwhelming supervisor.
**Status:** Planned mitigation — validate and rate-limit protocol messages; drop malformed messages.
**Evidence required:** Integration test with malformed protocol stream.

### THR-M2-022: Cancellation race

**Description:** Cancellation signal arrives during critical section, leaving inconsistent state.
**Status:** Planned mitigation — use cancellation tokens checked at safe points; ensure cleanup runs.
**Evidence required:** Unit test with cancellation at various lifecycle points.

### THR-M2-023: Crash loop

**Description:** Child crashes immediately after spawn, causing rapid restart attempts.
**Status:** Planned mitigation — apply exponential backoff to restarts; stop after threshold.
**Evidence required:** Integration test with child that exits immediately.

### THR-M2-024: Restart storm

**Description:** Child crashes repeatedly, exhausting supervisor resources.
**Status:** Planned mitigation — limit restarts to 5 in 60 seconds; stop and escalate on storm.
**Evidence required:** Integration test with rapid crash loop.

### THR-M2-025: Secrets in diagnostics

**Description:** Supervisor logs sensitive data (tokens, passwords) in error messages or stack traces.
**Status:** Planned mitigation — redact sensitive fields in Display and Debug implementations.
**Evidence required:** Unit test verifying redaction in log output.

### THR-M2-026: Unsafe cleanup

**Description:** Supervisor deletes files or terminates processes outside its scope during cleanup.
**Status:** Planned mitigation — restrict cleanup to owned resources; validate paths before deletion.
**Evidence required:** Unit test with cleanup attempting to delete unrelated files.

### THR-M2-027: Uninstall deleting unrelated files

**Description:** Uninstall process deletes files outside the managed installation directory.
**Status:** Planned mitigation — restrict uninstall to managed root; validate paths before deletion.
**Evidence required:** Unit test with uninstall attempting to delete parent directory.
**Not applicable:** Milestone Two does not implement uninstall; deferred to future milestone.

## Summary

Twenty-seven threats identified. Twenty-four have planned mitigations with
evidence required. One is an accepted limitation (DLL hijacking). One is
not applicable (uninstall). One is blocked by Job Object design (descendant
escape).

No mitigation is claimed to exist before implementation. All planned
mitigations will be verified by tests in Slice B.
