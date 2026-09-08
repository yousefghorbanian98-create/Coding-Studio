# Resource Adoption Matrix

This document classifies all proposed resources for the Coding Studio backend
according to the OSS Adoption Policy (11-OSS-ADOPTION-POLICY.md).

## Classification Categories

- **Direct**: Runtime dependency required for production
- **Existing-Capability**: Already adopted in M1 or existing codebase
- **Engineering**: Development/testing tool (not runtime)
- **Security**: Security auditing or verification tool
- **Optional**: Requires separate privacy/security decision
- **Reference-Only**: Documentation or pattern reference (not adopted)
- **Deferred**: Not needed for current architecture
- **Rejected**: Incompatible with architecture or requirements

## Direct or Existing-Capability Candidates

### shadcn/ui

- **Status**: Frontend-only (not backend)
- **Classification**: Deferred for backend
- **Reason**: Backend milestone does not include UI components
- **Adoption trigger**: Frontend milestone (M3+)

### Tailwind CSS

- **Status**: Frontend-only (not backend)
- **Classification**: Deferred for backend
- **Reason**: Backend milestone does not include styling
- **Adoption trigger**: Frontend milestone (M3+)

### Zustand

- **Status**: Frontend-only (not backend)
- **Classification**: Deferred for backend
- **Reason**: Backend milestone does not include state management
- **Adoption trigger**: Frontend milestone (M3+)

### Motion

- **Status**: Frontend-only (not backend)
- **Classification**: Deferred for backend
- **Reason**: Backend milestone does not include animations
- **Adoption trigger**: Frontend milestone (M3+)

### Vitest

- **Status**: Already adopted
- **Classification**: Existing-Capability
- **Repository**: https://github.com/vitest-dev/vitest
- **Version**: 1.6.0 (from package.json)
- **License**: MIT
- **Purpose**: Frontend unit testing
- **Backend relevance**: None (Rust tests use cargo test)

### Playwright

- **Status**: Already adopted
- **Classification**: Existing-Capability
- **Repository**: https://github.com/microsoft/playwright
- **Version**: 1.44.0 (from package.json)
- **License**: Apache-2.0
- **Purpose**: E2E testing
- **Backend relevance**: Integration testing with Tauri app (M3+)

### Mermaid

- **Status**: Not evaluated
- **Classification**: Optional
- **Repository**: https://github.com/mermaid-js/mermaid
- **License**: MIT
- **Purpose**: Diagram generation
- **Backend relevance**: Documentation only (not runtime)
- **Decision**: Reference-only for architecture diagrams

## Engineering and Security Candidates

### rustfmt

- **Status**: Already in use
- **Classification**: Existing-Capability
- **Purpose**: Rust code formatting
- **CI integration**: cargo fmt --check
- **Decision**: Continue using

### Clippy

- **Status**: Already in use
- **Classification**: Existing-Capability
- **Purpose**: Rust linting
- **CI integration**: cargo clippy -- -D warnings
- **Decision**: Continue using

### cargo-audit

- **Status**: Not adopted
- **Classification**: Engineering
- **Repository**: https://github.com/rustsec/rustsec
- **License**: MIT OR Apache-2.0
- **Purpose**: Audit Rust dependencies for known vulnerabilities
- **Runtime cost**: None (dev tool)
- **Security impact**: Positive (vulnerability detection)
- **Privacy impact**: None
- **Adoption trigger**: M2 completion (post-Slice B)
- **Decision**: Deferred to post-M2 security review

### cargo-deny

- **Status**: Not adopted
- **Classification**: Engineering
- **Repository**: https://github.com/EmbarkStudios/cargo-deny
- **License**: MIT OR Apache-2.0
- **Purpose**: Check dependencies for license compliance, bans, duplicates
- **Runtime cost**: None (dev tool)
- **Security impact**: Positive (license compliance)
- **Privacy impact**: None
- **Adoption trigger**: M2 completion (post-Slice B)
- **Decision**: Deferred to post-M2 supply-chain review

### cargo-nextest

- **Status**: Not adopted
- **Classification**: Engineering
- **Repository**: https://github.com/nextest-rs/nextest
- **License**: MIT OR Apache-2.0
- **Purpose**: Faster Rust test runner
- **Runtime cost**: None (dev tool)
- **Security impact**: None
- **Privacy impact**: None
- **Adoption trigger**: Test suite becomes slow (>5 min)
- **Decision**: Deferred (current cargo test is sufficient)

### proptest

- **Status**: Not adopted
- **Classification**: Engineering
- **Repository**: https://github.com/proptest-rs/proptest
- **License**: MIT OR Apache-2.0
- **Purpose**: Property-based testing for Rust
- **Runtime cost**: None (dev dependency)
- **Security impact**: Positive (better test coverage)
- **Privacy impact**: None
- **Adoption trigger**: Complex parsing/validation logic (M2+)
- **Decision**: Evaluate for Slice B property tests

### cargo-fuzz

- **Status**: Not adopted
- **Classification**: Engineering
- **Repository**: https://github.com/rust-fuzz/cargo-fuzz
- **License**: MIT OR Apache-2.0
- **Purpose**: Fuzz testing for Rust
- **Runtime cost**: None (dev tool)
- **Security impact**: Positive (fuzz testing)
- **Privacy impact**: None
- **Adoption trigger**: Security-critical parsing code (M2+)
- **Decision**: Evaluate for Slice B security testing

### SBOM generation

- **Status**: Not adopted
- **Classification**: Security
- **Tools**: cargo-sbom, cyclonedx-rs
- **Purpose**: Generate software bill of materials
- **Runtime cost**: None (dev tool)
- **Security impact**: Positive (supply-chain transparency)
- **Privacy impact**: None
- **Adoption trigger**: Release preparation (M2+)
- **Decision**: Deferred to release engineering phase

### Windows code signing

- **Status**: Not adopted
- **Classification**: Security
- **Tools**: signtool, Azure Trusted Signing
- **Purpose**: Sign Windows executables
- **Runtime cost**: None (release tool)
- **Security impact**: Positive (authenticity verification)
- **Privacy impact**: None
- **Adoption trigger**: Public release (M2+)
- **Decision**: Deferred to release engineering phase

### Secure desktop update verification

- **Status**: Implemented via Tauri
- **Classification**: Existing-Capability
- **Purpose**: Verify update authenticity
- **Implementation**: Tauri updater with signature verification
- **Decision**: Continue using Tauri updater

## Optional (Requiring Separate Privacy/Security Decision)

### Sentry

- **Status**: Not adopted
- **Classification**: Optional
- **Repository**: https://github.com/getsentry/sentry-rust
- **License**: MIT
- **Purpose**: Error tracking and monitoring
- **Runtime cost**: Moderate (network calls, data collection)
- **Security impact**: Requires security review (data exfiltration risk)
- **Privacy impact**: High (collects error data, potentially user data)
- **Adoption trigger**: Explicit privacy policy decision
- **Decision**: Rejected for M2 (privacy-sensitive, not required)

### Promptfoo

- **Status**: Not adopted
- **Classification**: Optional
- **Repository**: https://github.com/promptfoo/promptfoo
- **License**: MIT
- **Purpose**: LLM prompt testing
- **Runtime cost**: None (dev tool)
- **Security impact**: None
- **Privacy impact**: None
- **Adoption trigger**: Provider integration (M5+)
- **Decision**: Deferred to provider milestone

### garak

- **Status**: Not adopted
- **Classification**: Optional
- **Repository**: https://github.com/leondz/garak
- **License**: Apache-2.0
- **Purpose**: LLM vulnerability scanner
- **Runtime cost**: None (dev tool)
- **Security impact**: Positive (security testing)
- **Privacy impact**: None
- **Adoption trigger**: Provider integration (M5+)
- **Decision**: Deferred to provider milestone

### OpenTelemetry

- **Status**: Not adopted
- **Classification**: Optional
- **Repository**: https://github.com/open-telemetry/opentelemetry-rust
- **License**: Apache-2.0
- **Purpose**: Distributed tracing and metrics
- **Runtime cost**: High (instrumentation overhead, data collection)
- **Security impact**: Requires security review (data exfiltration risk)
- **Privacy impact**: High (collects telemetry data)
- **Adoption trigger**: Explicit privacy policy decision
- **Decision**: Rejected for M2 (privacy-sensitive, overkill for desktop app)

### Syft

- **Status**: Not adopted
- **Classification**: Optional
- **Repository**: https://github.com/anchore/syft
- **License**: Apache-2.0
- **Purpose**: SBOM generation
- **Runtime cost**: None (dev tool)
- **Security impact**: Positive (supply-chain transparency)
- **Privacy impact**: None
- **Adoption trigger**: Release preparation (M2+)
- **Decision**: Deferred to release engineering phase

### CycloneDX

- **Status**: Not adopted
- **Classification**: Optional
- **Repository**: https://github.com/CycloneDX/cyclonedx-rust-cargo
- **License**: Apache-2.0
- **Purpose**: SBOM standard
- **Runtime cost**: None (dev tool)
- **Security impact**: Positive (supply-chain transparency)
- **Privacy impact**: None
- **Adoption trigger**: Release preparation (M2+)
- **Decision**: Deferred to release engineering phase

### Sigstore

- **Status**: Not adopted
- **Classification**: Optional
- **Repository**: https://github.com/sigstore/sigstore-rs
- **License**: Apache-2.0
- **Purpose**: Keyless signing and verification
- **Runtime cost**: Low (verification only)
- **Security impact**: Positive (supply-chain security)
- **Privacy impact**: None
- **Adoption trigger**: Release preparation (M2+)
- **Decision**: Deferred to release engineering phase

## Reference-Only

### OWASP Cheat Sheet Series

- **Status**: Reference
- **Classification**: Reference-Only
- **Repository**: https://github.com/OWASP/CheatSheetSeries
- **License**: CC BY-SA 4.0
- **Purpose**: Security best practices
- **Decision**: Reference for security review (not adopted as dependency)

### n8n workflows

- **Status**: Reference
- **Classification**: Reference-Only
- **Repository**: https://github.com/Zie619/n8n-workflows
- **License**: Various
- **Purpose**: Workflow pattern research
- **Decision**: Reference for orchestration patterns (not adopted as runtime)

### EnterpriseArchitecture

- **Status**: Reference
- **Classification**: Reference-Only
- **Repository**: https://github.com/DovAmir/awesome-design-patterns
- **License**: Various
- **Purpose**: Architecture pattern research
- **Decision**: Reference for design decisions (not adopted as dependency)

### solution-architecture-patterns

- **Status**: Reference
- **Classification**: Reference-Only
- **Repository**: https://github.com/chanakaudaya/solution-architecture-patterns
- **License**: Apache-2.0
- **Purpose**: Architecture pattern research
- **Decision**: Reference for design decisions (not adopted as dependency)

### CleanArchitecture

- **Status**: Reference
- **Classification**: Reference-Only
- **Repository**: https://github.com/ardalis/CleanArchitecture
- **License**: MIT
- **Purpose**: Architecture pattern research
- **Decision**: Reference for module organization (not adopted as dependency)

### DBML

- **Status**: Reference
- **Classification**: Reference-Only
- **Repository**: https://github.com/holistics/dbml
- **License**: Apache-2.0
- **Purpose**: Database markup language
- **Decision**: Not applicable (no database in M2)

### product-requirements-doc-template

- **Status**: Reference
- **Classification**: Reference-Only
- **Repository**: Various
- **License**: Various
- **Purpose**: PRD template
- **Decision**: Reference for documentation (not adopted as dependency)

### spec

- **Status**: Reference
- **Classification**: Reference-Only
- **Repository**: Various
- **License**: Various
- **Purpose**: Specification templates
- **Decision**: Reference for documentation (not adopted as dependency)

## Deferred or Rejected

### Next.js

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app uses Tauri, not web framework
- **Decision**: Incompatible with protected architecture

### NestJS

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app uses Tauri + Rust, not Node.js backend
- **Decision**: Incompatible with protected architecture

### tRPC

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app uses Tauri IPC, not HTTP API
- **Decision**: Incompatible with protected architecture

### Kong

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not need API gateway
- **Decision**: Incompatible with desktop architecture

### Redis

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not need distributed cache
- **Decision**: Incompatible with desktop architecture

### Prisma

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not use SQL database
- **Decision**: Incompatible with M2 scope

### Vault

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app uses Windows Credential Manager, not cloud vault
- **Decision**: Incompatible with desktop architecture

### Dokploy

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not need deployment platform
- **Decision**: Incompatible with desktop architecture

### Argo CD

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not use Kubernetes
- **Decision**: Incompatible with desktop architecture

### Terraform

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not need infrastructure-as-code
- **Decision**: Incompatible with desktop architecture

### Pulumi

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not need infrastructure-as-code
- **Decision**: Incompatible with desktop architecture

### LangChain

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app delegates to Jcode, not direct LLM integration
- **Decision**: Incompatible with protected architecture

### Letta

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app delegates to Jcode, not direct agent framework
- **Decision**: Incompatible with protected architecture

### browser-use

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not include browser automation
- **Decision**: Out of M2 scope

### Prometheus

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not need distributed metrics collection
- **Decision**: Incompatible with desktop architecture

### Grafana

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Desktop app does not need dashboard visualization
- **Decision**: Incompatible with desktop architecture

### Docusaurus

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Documentation uses Markdown in repository, not static site generator
- **Decision**: Out of M2 scope

### Mintlify

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Documentation uses Markdown in repository, not hosted docs platform
- **Decision**: Out of M2 scope

### daisyUI

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Frontend-only, not backend
- **Decision**: Deferred to frontend milestone (M3+)

### 21st.dev

- **Status**: Rejected
- **Classification**: Deferred
- **Reason**: Frontend-only, not backend
- **Decision**: Deferred to frontend milestone (M3+)

## Summary

### Adopted for M2

- **Rust standard library**: Core language and std
- **sha2 0.10**: SHA-256 hashing (reused from M1)
- **serde/serde_json**: Serialization (reused from M1)
- **windows-sys 0.52**: Windows FFI (minimal features)
- **tempfile 3**: Temporary files (dev dependency)

### Evaluated for M2

- **reqwest 0.12**: HTTP client (minimal features, rustls-tls)
- **tokio 1.x**: Async runtime (minimal features, required by reqwest)
- **thiserror 1.0**: Error types (may be removed if manual impl preferred)

### Deferred to Post-M2

- cargo-audit (security review)
- cargo-deny (supply-chain review)
- SBOM generation (release engineering)
- Windows code signing (release engineering)

### Rejected for M2

- All cloud/distributed infrastructure (Next.js, NestJS, Kong, Redis, etc.)
- All observability platforms (Sentry, OpenTelemetry, Prometheus, Grafana)
- All LLM frameworks (LangChain, Letta)
- All frontend resources (shadcn/ui, Tailwind, Zustand, etc.)

## Compliance

This matrix complies with:
- 11-OSS-ADOPTION-POLICY.md
- 10-N8N-RESEARCH-POLICY.md
- Protected architecture (React → Tauri IPC → Rust → Jcode → Provider)
- No cloud infrastructure without separate approval
- No distributed observability without separate privacy decision
