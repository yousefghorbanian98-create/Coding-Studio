# Milestone Two OSS Register

## Scope

This register records every open-source dependency candidate evaluated for
Milestone Two. No dependency is added in Slice A. This document records
research and evaluation only.

## Already-Adopted Milestone One Dependency

### sha2

- **Repository:** https://github.com/RustCrypto/hashes
- **Current stable version:** 0.10.8 (as of 2026-09-07, retrieved from crates.io)
- **License:** MIT OR Apache-2.0
- **MSRV:** 1.72
- **Compatibility with project rust-version 1.77.2:** Compatible
- **Maintenance:** Active, maintained by RustCrypto project
- **Windows support:** Pure Rust, cross-platform
- **Transitive weight:** Minimal (depends on `digest` crate)
- **Status:** **Already adopted in Milestone One** (`sha2 = "0.10"` in `src-tauri/Cargo.toml`)
- **M2 relevance:** Used for SHA-256 checksum verification of downloaded Jcode binaries

## Candidates Evaluated

Registry metadata retrieved 2026-09-07 from crates.io and docs.rs.

### 1. windows-sys

- **Repository:** https://github.com/microsoft/windows-rs
- **Current stable line:** 0.61.x (latest 0.61.2, released 2025-10-06)
- **Selected compatible version:** 0.52.0 (widely used, stable API for Job Object APIs)
- **License:** MIT OR Apache-2.0
- **MSRV:** 1.71.0 (0.61.x); 1.56.0 (0.52.0)
- **Compatibility with project rust-version 1.77.2:** Compatible (both 0.52 and 0.61)
- **Maintenance:** Active, maintained by Microsoft
- **Windows support:** Native Windows bindings
- **Transitive weight:** Minimal (no transitive dependencies; uses windows-link for raw-dylib in 0.61+)
- **Default features:** None (feature-gated by API area)
- **Minimum feature set for M2:** `Win32_System_JobObjects`, `Win32_System_Threading`, `Win32_Foundation`, `Win32_Security`
- **Security relevance:** High (provides Windows API bindings for Job Object, process management)
- **Alternatives considered:**
  - `winapi`: Older, unmaintained, last release 2020
  - `windows`: Higher-level wrapper, adds safe abstractions but increases compile time
  - `windows-bindgen`: Build-time code generation, reduces compile overhead for large API surfaces
- **Evaluation:**
  - **Pros:** Official Microsoft project, actively maintained, minimal transitive weight, provides exact Windows API bindings needed (CreateJobObject, AssignProcessToJobObject, SetInformationJobObject)
  - **Cons:** Requires `unsafe` blocks for FFI calls, low-level API requires careful handle management
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved)
  - **Reason:** Provides necessary Windows Job Object API bindings with minimal overhead. Preferred over `winapi` (unmaintained) and `windows` (higher compile cost). Must be evaluated in Slice B with actual usage and safety review.

### 2. reqwest

- **Repository:** https://github.com/seanmonstar/reqwest
- **Current stable line:** 0.13.x (latest 0.13.4, released 2026-05-25)
- **0.12.x stable line:** Latest 0.12.26 (released 2025-10-13)
- **License:** MIT OR Apache-2.0
- **MSRV:** 1.85.0 (0.13.x); ~1.63.0 (0.12.x, estimated from release era)
- **Compatibility with project rust-version 1.77.2:** 0.13.x is **NOT compatible** (MSRV 1.85.0 > 1.77.2). 0.12.x is compatible.
- **Maintenance:** Active, widely used
- **Windows support:** Cross-platform HTTP client
- **Default TLS backend:** native-tls (system-native on Windows/macOS, OpenSSL on Linux); rustls available via `rustls-tls` feature
- **Proxy behavior:** Respects HTTP_PROXY and HTTPS_PROXY environment variables by default; can be disabled
- **Transitive weight:** Moderate (depends on `hyper`, `tokio`, `rustls` or `native-tls`, `http`, `http-body`)
- **Security relevance:** Medium (network communication, TLS)
- **Alternatives considered:**
  - `ureq`: Synchronous HTTP client, simpler but blocks async runtime
  - `isahc`: curl bindings, requires system libcurl
  - Standard library: No HTTP client in std
  - Manual implementation: High risk, complex TLS handling
- **Evaluation:**
  - **Pros:** Async-native, supports streaming downloads, progress callbacks, TLS by default, widely used and audited
  - **Cons:** Moderate transitive weight, requires async runtime. 0.13.x MSRV (1.85.0) exceeds project rust-version (1.77.2); must use 0.12.x or bump project MSRV.
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved). If adopted, must use 0.12.x line (compatible with rust-version 1.77.2). Do not select 0.13 merely because it is newest.
  - **Reason:** Industry-standard async HTTP client with streaming support. Must verify 0.12.x MSRV compatibility before adoption. Do not assume Tokio is required before the final transport design is selected.

### 3. tokio

- **Repository:** https://github.com/tokio-rs/tokio
- **Current stable line:** 1.53.x (latest 1.53.1, released 2026-07-20)
- **LTS lines:** 1.47.x (MSRV 1.70, LTS until 2026-09), 1.51.x (MSRV 1.71, LTS until 2027-03)
- **License:** MIT
- **MSRV:** 1.71.0 (current stable)
- **Compatibility with project rust-version 1.77.2:** Compatible
- **Maintenance:** Active, de facto standard async runtime
- **Windows support:** Cross-platform async runtime
- **Default features:** None (all features opt-in)
- **Minimum feature set for M2:** `process`, `io-util`, `sync`, `time`, `rt`, `macros` (if used)
- **Transitive weight:** Moderate (core runtime + selected features)
- **Security relevance:** Medium (async task scheduling, I/O, timers)
- **Alternatives considered:**
  - `async-std`: Alternative async runtime, smaller ecosystem
  - `smol`: Minimal async runtime, less mature
  - Synchronous implementation: Blocks on I/O, poor scalability
- **Evaluation:**
  - **Pros:** Industry-standard async runtime, provides process spawning (`tokio::process`), timers, channels
  - **Cons:** Moderate transitive weight, requires async/await throughout codebase
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved). Do not assume Tokio is required before the final transport design is selected.
  - **Reason:** De facto standard async runtime. Preferred over `async-std` (smaller ecosystem) and `smol` (less mature). Must be evaluated in Slice B with actual usage and runtime configuration review.

### 4. thiserror

- **Repository:** https://github.com/dtolnay/thiserror
- **Current stable line:** 2.0.x (latest 2.0.20, released 2026-08-08)
- **1.x stable line:** Latest 1.0.63 (final 1.x release)
- **License:** MIT OR Apache-2.0
- **MSRV:** 1.71.0 (2.0.x)
- **Compatibility with project rust-version 1.77.2:** Compatible (both 1.x and 2.0.x)
- **Maintenance:** Active, maintained by dtolnay
- **Windows support:** Cross-platform error handling
- **Default features:** `std` (enabled by default)
- **Minimum feature set for M2:** `std` (default)
- **Transitive weight:** Minimal (proc-macro only; thiserror-impl)
- **Security relevance:** Low (error type derivation)
- **Alternatives considered:**
  - `anyhow`: Dynamic error handling, loses type safety
  - Manual `Display` and `Error` implementations: Verbose, error-prone
- **Evaluation:**
  - **Pros:** Derives `Display` and `Error` implementations, preserves type safety, minimal transitive weight
  - **Cons:** Proc-macro compile cost
  - **Decision:** **Candidate for adoption in Slice B** (not pre-approved)
  - **Reason:** Industry-standard error derivation with type safety. Preferred over `anyhow` (dynamic) and manual implementations (verbose). Must be evaluated in Slice B with actual usage.

### 5. tracing

- **Repository:** https://github.com/tokio-rs/tracing
- **Latest version:** 0.1.40 (as of 2026-09-07)
- **License:** MIT
- **MSRV:** 1.63.0
- **Compatibility with project rust-version 1.77.2:** Compatible
- **Maintenance:** Active, maintained by tokio-rs
- **Windows support:** Cross-platform structured logging
- **Default features:** `std`, `log`
- **Minimum feature set for M2:** `std`
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
- **Reason:** Heavier than `sha2`, includes unsafe code, overkill for single hash algorithm. `sha2` is already adopted in Milestone One.

### 3. ureq

- **Repository:** https://github.com/algesten/ureq
- **Decision:** **Rejected for async download**
- **Reason:** Synchronous HTTP client would block async runtime, incompatible with tokio-based architecture.

## Dependency Decision Shortlist

For Slice B implementation, the following candidates are shortlisted for
further evaluation:

1. `windows-sys` 0.52.0 — Windows Job Object API bindings (MSRV 1.56.0, compatible)
2. `reqwest` 0.12.26 — Async HTTP client for downloads (0.13.x MSRV 1.85.0 exceeds project 1.77.2; must use 0.12.x)
3. `tokio` 1.53.1 — Async runtime (MSRV 1.71.0, compatible; do not assume required before transport design)
4. `thiserror` 2.0.20 — Error type derivation (MSRV 1.71.0, compatible)
5. `tracing` 0.1.40 — Structured logging (MSRV 1.63.0, compatible)
6. `sha2` 0.10.8 — **Already adopted in Milestone One** (not a new candidate)

**No dependency is pre-approved.** Each must be evaluated in Slice B with:
- Actual usage in code
- Safety review (especially `unsafe` blocks for `windows-sys`)
- Transitive dependency audit
- License compatibility verification
- Compile time impact measurement

## Standard Library Preference

Before adopting any dependency, the implementation must verify that the
standard library does not already provide the required functionality:

- **File I/O:** `std::fs` — `std::fs::rename` provides atomic rename on most platforms but does not fully solve Windows atomic replacement and rollback (MOVEFILE_REPLACE_EXISTING + MOVEFILE_WRITE_THROUGH semantics, or copy-and-rename with rollback). Additional Windows-specific code may be needed.
- **Process spawning:** `std::process::Command` (insufficient, lacks async and Job Object support)
- **Networking:** `std::net` (insufficient, lacks HTTP and TLS)
- **Hashing:** None in std (SHA-256 required; already provided by `sha2` from M1)
- **Async:** None in std (tokio or alternative required if async transport is selected)

## Conclusion

Six dependency candidates evaluated with current registry metadata
(retrieved 2026-09-07). One (`sha2`) is already adopted from Milestone
One. Five are shortlisted for Slice B evaluation. No dependency is
pre-approved. `reqwest` 0.13.x is not compatible with the project's
declared rust-version 1.77.2; 0.12.x must be used if reqwest is adopted.
Tokio must not be assumed required before the final transport design is
selected. Standard library is preferred when genuinely sufficient, but
`std::fs::rename` alone does not fully solve Windows atomic replacement
and rollback.
