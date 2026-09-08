# Milestone Two Security Review

This document records the threat model for Milestone Two: managed Jcode
installation and Windows process supervisor. Each threat records a status:
planned mitigation, evidence required, accepted limitation, blocked, or not
applicable. No mitigation is claimed to exist before implementation.

## Installation Threats

### THR-M2-001: Release substitution

**Description:** An attacker substitutes the Jcode binary at the download URL with a malicious version.
**Status:** Planned mitigation — verify SHA-256 of the downloaded executable bytes against the Coding Studio trust anchor: the exact architecture-specific digest accepted and recorded in Milestone One. The GitHub release asset, co-located SHA256SUMS file, and GitHub API metadata are useful corroborating observations but remain inside the GitHub/upstream trust domain and are not independent trust channels.
**Evidence required:** Integration test with mock server serving substituted binary; checksum verification against the M1-accepted anchor rejects it. Installer evidence produced in Slice B.

### THR-M2-002: Checksum substitution

**Description:** An attacker compromises both the binary and the checksum file, making verification pass.
**Status:** Planned mitigation — the Coding Studio trust anchor is the exact architecture-specific executable SHA-256 digest accepted in Milestone One, not a co-located checksum file. The GitHub API digest and SHA256SUMS are corroborating observations inside the GitHub trust domain; they may be compared as additional signals but never replace the M1-accepted anchor.
**Evidence required:** Verify that the installer rejects any binary whose SHA-256 does not match the M1-accepted anchor, regardless of what the GitHub API or SHA256SUMS report. Installer evidence produced in Slice B.

### THR-M2-003: Mutable release assets

**Description:** Upstream replaces a release asset without changing the version tag, invalidating pinned checksums.
**Status:** Planned mitigation — use the fixed version-scoped HTTPS URL; stream and verify the exact architecture-specific executable bytes; require the embedded Milestone-One-accepted SHA-256 before promotion and again before execution as designed; treat the release asset ID, tag, and tagged source commit only as provenance or change-detection observations; none of those observations substitutes for executable-byte SHA-256; upstream replacement at the same URL must fail closed on digest mismatch.
**Evidence required:** Integration test where the same URL serves a different binary; installer rejects on digest mismatch. Installer evidence produced in Slice B.

### THR-M2-004: Redirect abuse

**Description:** Download URL redirects to an unauthorized host serving a malicious binary.
**Status:** Planned mitigation — restrict redirects to an allowlist of trusted hosts; reject unauthorized redirects.
**Evidence required:** Unit test with redirect to unauthorized host. Installer evidence produced in Slice B.

### THR-M2-005: Partial download

**Description:** Download is interrupted, leaving a partial binary that passes checksum if only partial bytes are hashed.
**Status:** Planned mitigation — verify checksum only after complete download; reject partial downloads.
**Evidence required:** Integration test with interrupted download. Installer evidence produced in Slice B.

### THR-M2-006: Oversized download

**Description:** Download exceeds the exact expected architecture-specific size.
**Status:** Planned mitigation — reject when Content-Length disagrees with expected size (when present); count actual streamed bytes; reject if actual bytes exceed expected size by even one byte; reject if stream ends before the exact expected size.
**Evidence required:** Integration test with oversized, undersized, and Content-Length-disagreeing responses. Installer evidence produced in Slice B.

### THR-M2-007: Disk exhaustion

**Description:** Installation fills disk, causing system instability.
**Status:** Planned mitigation — available-space preflight is advisory; the write itself remains authoritative. Enforce exact architecture-specific size limits.
**Evidence required:** Unit test with mocked low-disk-space condition. Installer evidence produced in Slice B.

### THR-M2-008: Concurrent installers

**Description:** Two installer instances race, corrupting the installation.
**Status:** Planned mitigation — use file locking or atomic rename to serialize installation.
**Evidence required:** Integration test spawning concurrent installers. Installer evidence produced in Slice B.

### THR-M2-009: TOCTOU replacement

**Description:** Binary is replaced between checksum verification and execution.
**Status:** Planned mitigation — verify checksum immediately before execution; require the M1-accepted SHA-256 again before execution.
**Evidence required:** Unit test with TOCTOU race scenario. Installer evidence produced in Slice B.

### THR-M2-010: Path traversal

**Description:** Installation path contains `..` or other traversal, writing outside intended directory.
**Status:** Planned mitigation — canonicalize and validate installation path; reject paths outside managed root.
**Evidence required:** Unit test with traversal attempts. Installer evidence produced in Slice B.

### THR-M2-011: Symlink/junction/reparse escape

**Description:** Installation path contains a symlink or junction pointing outside the managed root.
**Status:** Planned mitigation — detect and reject symlinks, junctions, and reparse points in installation path.
**Evidence required:** Unit test with junction pointing to parent directory. Installer evidence produced in Slice B.

### THR-M2-012: Unsafe temporary paths

**Description:** Temporary download file is created in a world-writable directory, allowing substitution.
**Status:** Planned mitigation — create temp file in a secure, user-owned directory with restrictive permissions.
**Evidence required:** Unit test verifying temp file permissions. Installer evidence produced in Slice B.

### THR-M2-013: DLL search hijacking

**Description:** Malicious DLL is placed in a directory in the child's DLL search path, loaded by Jcode at startup.
**Status:** Planned mitigation — use fully qualified executable path; set controlled child working directory; sanitize or omit inherited PATH where feasible; ensure no untrusted writable directory is in the child DLL search path. Evaluate child-specific process mitigation and loader behavior from Microsoft primary documentation (SetDefaultDllDirectories, LOAD_LIBRARY_SEARCH_SYSTEM32). Do not mutate the parent Coding Studio process-wide DLL search state (e.g., SetDllDirectory) as an incidental spawn operation.
**Evidence required:** Windows CI evidence that the child process does not load DLLs from untrusted directories. Spawn/path evidence produced in Slice C.
**Accepted limitation:** Residual DLL dependency-loading risk remains explicit until implementation and Windows evidence exist. Cannot prevent all DLL hijacking vectors; mitigate known high-risk paths.

## Supervisor Threats

### THR-M2-014: Shell and argument injection

**Description:** Child process is spawned via shell, allowing command injection through arguments.
**Status:** Planned mitigation — pass the executable as a verified fully qualified path; pass arguments as structured argv entries through the process API; never concatenate a shell command; reject unsupported argument forms at the contract boundary. Use the `m2-test-helper` in `argv-capture` mode to prove metacharacters remain literal argv data, not interpreted shell tokens.
**Evidence required:** Unit test with shell metacharacters in arguments proving they remain literal. Spawn evidence produced in Slice C.

### THR-M2-015: Credential and proxy leakage

**Description:** Child process inherits environment variables containing credentials or proxy settings.
**Status:** Planned mitigation — filter environment to allowlist; do not inherit credentials.
**Evidence required:** Unit test verifying child does not receive credentials. Spawn evidence produced in Slice C.

### THR-M2-016: Process escape before containment

**Description:** Child process executes code before being assigned to Job Object, allowing escape.
**Status:** Planned mitigation — create process suspended, assign to Job Object, then resume. Suspended creation plus Job assignment before resume is the planned design. KILL_ON_JOB_CLOSE and absence of breakaway permissions are planned controls. Nested-host-Job behavior and descendant containment require Windows tests. Assignment or hierarchy incompatibility fails closed while the child remains suspended.
**Evidence required:** Unit test verifying Job assignment before first instruction. Spawn/Job evidence produced in Slice C. Descendant containment remains unproven until Slice C evidence passes.

### THR-M2-017: Orphan descendants

**Description:** Child spawns descendants that survive parent termination.
**Status:** Planned mitigation — use Job Object with KILL_ON_JOB_CLOSE to terminate entire tree. No breakaway flag may be granted. Descendant containment remains unproven until Slice C evidence passes.
**Evidence required:** Integration test with child spawning long-running grandchild. Job evidence produced in Slice C.

### THR-M2-018: PID reuse

**Description:** Supervisor tracks child by PID, but PID is reused after child exits, targeting wrong process.
**Status:** Planned mitigation — track child by handle, not PID; use handle-based operations.
**Evidence required:** Unit test verifying handle-based tracking. Lifecycle evidence produced in Slice D.

### THR-M2-019: stdout/stderr deadlock

**Description:** Child writes to stdout and stderr; supervisor reads only one, causing deadlock.
**Status:** Planned mitigation — read both streams concurrently using async tasks or threads.
**Evidence required:** Integration test with `m2-test-helper` writing to both streams at high rate. Stream evidence produced in Slice D.

### THR-M2-020: Unbounded output

**Description:** Child produces output faster than supervisor can consume, exhausting memory.
**Status:** Planned mitigation — bounded item and byte queues; backpressure while the consumer can recover; bounded progress deadline; explicit resource-exhaustion termination if the deadline expires; never silently drop or truncate a valid structured protocol event. Raw diagnostic stderr retention is different from protocol event delivery: it may retain a bounded, redacted tail; any truncation must have an explicit marker; no secret may be retained before redaction.
**Evidence required:** Integration test with `m2-test-helper` producing output at max rate. Stream evidence produced in Slice D.

### THR-M2-021: Malformed protocol flood

**Description:** Child sends malformed or excessive protocol messages, overwhelming supervisor.
**Status:** Planned mitigation — validate frames using the accepted M1 FrameDecoder contract; account for malformed frames; reject/terminate a persistently malformed stream using a stable protocol error; apply backpressure to excessive valid events; do not rate-drop valid events.
**Evidence required:** Integration test with malformed protocol stream. Stream evidence produced in Slice D.

### THR-M2-022: Cancellation race

**Description:** Cancellation signal arrives during critical section, leaving inconsistent state.
**Status:** Planned mitigation — use cancellation tokens checked at safe points; ensure cleanup runs.
**Evidence required:** Unit test with cancellation at various lifecycle points. Lifecycle evidence produced in Slice D.

### THR-M2-023: Crash loop

**Description:** Child crashes immediately after spawn, causing rapid restart attempts.
**Status:** Planned mitigation — restart is disabled by default; no crash automatically restarts unless an explicit trusted policy enables it. If enabled, retain a bounded attempt/window/backoff policy. Reset restart accounting only after a documented stability condition. Never restart integrity, identity, containment, workspace-validation, cancellation, or explicit user-stop failures. Classify retryability before applying restart policy.
**Evidence required:** Integration test with child that exits immediately. Restart evidence produced in Slice D.

### THR-M2-024: Restart storm

**Description:** Child crashes repeatedly, exhausting supervisor resources.
**Status:** Planned mitigation — restart is disabled by default. If enabled, limit restarts with bounded attempt/window/backoff; stop and escalate on storm. Exact numerical limits are preliminary until Slice D tests justify them.
**Evidence required:** Integration test with rapid crash loop. Restart evidence produced in Slice D.

### THR-M2-025: Secrets in diagnostics

**Description:** Supervisor logs sensitive data (tokens, passwords) in error messages or stack traces.
**Status:** Planned mitigation — redact sensitive fields in Display and Debug implementations.
**Evidence required:** Unit test verifying redaction in log output. Diagnostic evidence produced in Slice D.

### THR-M2-026: Unsafe cleanup

**Description:** Supervisor deletes files or terminates processes outside its scope during cleanup.
**Status:** Planned mitigation — restrict cleanup to owned resources; validate paths before deletion.
**Evidence required:** Unit test with cleanup attempting to delete unrelated files. Lifecycle evidence produced in Slice D.

### THR-M2-027: Uninstall deleting unrelated files

**Description:** Uninstall process deletes files outside the managed installation directory.
**Status:** Not applicable — Milestone Two does not implement uninstall; deferred to future milestone.
**Evidence required:** None in Milestone Two.

## Summary

Twenty-seven threat entries total:

- Twenty-six in-scope entries have planned mitigations requiring evidence.
- THR-M2-013 also records a residual accepted DLL-loading limitation.
- THR-M2-027 is out of Milestone Two scope / not applicable.
- No threat is currently classified as proven blocked.

Evidence ownership by slice:

- Installer evidence (THR-M2-001 through THR-M2-012) is produced in Slice B.
- Spawn/path/Job evidence (THR-M2-013 through THR-M2-017) is produced in Slice C.
- Stream/lifecycle/restart/diagnostic evidence (THR-M2-018 through THR-M2-026) is produced in Slice D.
- Final adversarial evidence is reviewed in Slice E.

No mitigation is claimed to exist before implementation.
