# Milestone Two OSS Register

## Scope

This register records every open-source dependency candidate evaluated for
Milestone Two. No dependency is added in Slice A. This document records
research and evaluation only.

## Evaluation Criteria

Each candidate is evaluated against the OSS adoption policy in
`11-OSS-ADOPTION-POLICY.md`:

- Official repository and license
- Maintenance status and release cadence
- Windows support
- Transitive dependency weight
- Security relevance
- Alternatives considered
- Build-versus-adopt decision

## Candidates Evaluated

### 1. windows-sys

- **Repository:** https://github.com/microsoft/windows-rs
- **Latest version:** 0.52.0 (as of 2026-09-07)
- **License:** MIT OR Apache-2.0
- **Maintenance:** Active, maintained by Microsoft
- **Windows support:** Native Windows bindings
- **Transitive weight:** Minimal (no transitive dependencies)
- **Security relevance:** High (provides Windows API bindings for Job Object, process management)
- **Alternatives considered:**
  - `winapi`: Older, unmaintained, last release 2020
  - `windows`: Higher-level wrapper, adds safe abstractions but increases compile time
- **Evaluation:**
  - **Pros:** Official Microsoft project, actively maintained, minimal transitive weight, provides exact Windows API bindings needed (CreateJobObject, AssignProcessToJobObject, SetInformationJobObject)
  - **Cons:** Requires `unsafe` blocks for FFI calls, low-level API requires careful handle management
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved)
  - **Reason:** Provides necessary Windows Job Object API bindings with minimal overhead. Preferred over `winapi` (unmaintained) and `windows` (higher compile cost). Must be evaluated in Slice B with actual usage and safety review.

### 2. sha2

- **Repository:** https://github.com/RustCrypto/hashes
- **Latest version:** 0.10.8 (as of 2026-09-07)
- **License:** MIT OR Apache-2.0
- **Maintenance:** Active, maintained by RustCrypto project
- **Windows support:** Pure Rust, cross-platform
- **Transitive weight:** Minimal (depends on `digest` crate)
- **Security relevance:** High (cryptographic hash for checksum verification)
- **Alternatives considered:**
  - `ring`: More comprehensive crypto library, heavier, includes unsafe code
  - `blake3`: Faster hash, but not SHA-256 (required for Jcode checksums)
  - Standard library: No SHA-256 in std
- **Evaluation:**
  - **Pros:** Pure Rust, audited, widely used, minimal transitive weight, provides SHA-256 required for Jcode checksum verification
  - **Cons:** None identified
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved)
  - **Reason:** Industry-standard SHA-256 implementation with strong security track record. Preferred over `ring` (heavier) and `blake3` (wrong algorithm). Must be evaluated in Slice B with actual usage.

### 3. reqwest

- **Repository:** https://github.com/seanmonstar/reqwest
- **Latest version:** 0.12.5 (as of 2026-09-07)
- **License:** MIT OR Apache-2.0
- **Maintenance:** Active, widely used
- **Windows support:** Cross-platform HTTP client
- **Transitive weight:** Moderate (depends on `hyper`, `tokio`, `rustls` or `native-tls`)
- **Security relevance:** Medium (network communication, TLS)
- **Alternatives considered:**
  - `ureq`: Synchronous HTTP client, simpler but blocks async runtime
  - `isahc`: curl bindings, requires system libcurl
  - Standard library: No HTTP client in std
  - Manual implementation: High risk, complex TLS handling
- **Evaluation:**
  - **Pros:** Async-native, supports streaming downloads, progress callbacks, TLS by default, widely used and audited
  - **Cons:** Moderate transitive weight, requires async runtime (tokio)
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved)
  - **Reason:** Industry-standard async HTTP client with streaming support. Preferred over `ureq` (sync) and `isahc` (system dependency). Must be evaluated in Slice B with actual usage and TLS configuration review.

### 4. tokio

- **Repository:** https://github.com/tokio-rs/tokio
- **Latest version:** 1.38.0 (as of 2026-09-07)
- **License:** MIT
- **Maintenance:** Active, de facto standard async runtime
- **Windows support:** Cross-platform async runtime
- **Transitive weight:** Moderate (core runtime + optional features)
- **Security relevance:** Medium (async task scheduling, I/O, timers)
- **Alternatives considered:**
  - `async-std`: Alternative async runtime, smaller ecosystem
  - `smol`: Minimal async runtime, less mature
  - Synchronous implementation: Blocks on I/O, poor scalability
- **Evaluation:**
  - **Pros:** Industry-standard async runtime, required by `reqwest` and other async crates, provides process spawning (`tokio::process`), timers, channels
  - **Cons:** Moderate transitive weight, requires async/await throughout codebase
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved)
  - **Reason:** De facto standard async runtime, required by `reqwest`. Preferred over `async-std` (smaller ecosystem) and `smol` (less mature). Must be evaluated in Slice B with actual usage and runtime configuration review.

### 5. thiserror

- **Repository:** https://github.com/dtolnay/thiserror
- **Latest version:** 1.0.63 (as of 2026-09-07)
- **License:** MIT OR Apache-2.0
- **Maintenance:** Active, maintained by dtolnay
- **Windows support:** Cross-platform error handling
- **Transitive weight:** Minimal (proc-macro only)
- **Security relevance:** Low (error type derivation)
- **Alternatives considered:**
  - `anyhow`: Dynamic error handling, loses type safety
  - Manual `Display` and `Error` implementations: Verbose, error-prone
- **Evaluation:**
  - **Pros:** Derives `Display` and `Error` implementations, preserves type safety, minimal transitive weight
  - **Cons:** Proc-macro compile cost
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved)
  - **Reason:** Industry-standard error derivation with type safety. Preferred over `anyhow` (dynamic) and manual implementations (verbose). Must be evaluated in Slice B with actual usage.

### 6. tracing

- **Repository:** https://github.com/tokio-rs/tracing
- **Latest version:** 0.1.40 (as of 2026-09-07)
- **License:** MIT
- **Maintenance:** Active, maintained by tokio-rs
- **Windows support:** Cross-platform structured logging
- **Transitive weight:** Moderate (core + subscriber crates)
- **Security relevance:** Low (diagnostic logging)
- **Alternatives considered:**
  - `log`: Simpler logging facade, no structured context
  - `slog`: Structured logging, smaller ecosystem
  - `println!`: No structure, no filtering, no async support
- **Evaluation:**
  - **Pros:** Structured logging with spans and events, async-aware, integrates with tokio, widely used
  - **Cons:** Moderate transitive weight, requires subscriber configuration
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved)
  - **Reason:** Industry-standard structured logging with async support. Preferred over `log` (unstructured) and `slog` (smaller ecosystem). Must be evaluated in Slice B with actual usage and redaction review.

## Rejected Candidates

### 1. winapi

- **Repository:** https://github.com/retep998/winapi-rs
- **Last release:** 0.3.9 (2020)
- **Decision:** **Rejected**
- **Reason:** Unmaintained, superseded by official `windows-sys` crate.

### 2. ring

- **Repository:** https://github.com/briansmith/ring
- **Decision:** **Rejected for SHA-256**
- **Reason:** Heavier than `sha2`, includes unsafe code, overkill for single hash algorithm.

### 3. ureq

- **Repository:** https://github.com/algesten/ureq
- **Decision:** **Rejected for async download**
- **Reason:** Synchronous HTTP client would block async runtime, incompatible with tokio-based architecture.

## Dependency Decision Shortlist

For Slice B implementation, the following candidates are shortlisted for
further evaluation:

1. `windows-sys` 0.52.0 — Windows Job Object API bindings
2. `sha2` 0.10.8 — SHA-256 checksum verification
3. `reqwest` 0.12.5 — Async HTTP client for downloads
4. `tokio` 1.38.0 — Async runtime (required by reqwest)
5. `thiserror` 1.0.63 — Error type derivation
6. `tracing` 0.1.40 — Structured logging

**No dependency is pre-approved.** Each must be evaluated in Slice B with:
- Actual usage in code
- Safety review (especially `unsafe` blocks for `windows-sys`)
- Transitive dependency audit
- License compatibility verification
- Compile time impact measurement

## Standard Library Preference

Before adopting any dependency, the implementation must verify that the
standard library does not already provide the required functionality:

- **File I/O:** `std::fs` (sufficient for atomic rename)
- **Process spawning:** `std::process::Command` (insufficient, lacks async and Job Object support)
- **Networking:** `std::net` (insufficient, lacks HTTP and TLS)
- **Hashing:** None in std (SHA-256 required)
- **Async:** None in std (tokio required for reqwest)

## Conclusion

Six dependency candidates are evaluated and shortlisted for Slice B. No
dependency is pre-approved. Each must be evaluated with actual usage,
safety review, and transitive audit before adoption. Standard library is
preferred when genuinely sufficient, but complex security-sensitive
operations (HTTP, TLS, Job Object, SHA-256) require vetted dependencies.
