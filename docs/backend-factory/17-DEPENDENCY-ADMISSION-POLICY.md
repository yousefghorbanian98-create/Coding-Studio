# Dependency Admission Policy

This policy governs the admission of new dependencies into the Coding Studio
backend. It extends the OSS Adoption Policy (11-OSS-ADOPTION-POLICY.md) with
specific rules for Rust dependencies.

## Admission Criteria

Every new dependency must satisfy ALL of the following:

### 1. Demonstrated Project Need

- The dependency must solve a concrete, documented problem
- No existing capability in the codebase can solve the problem
- The benefit must outweigh the transitive dependency cost

### 2. Compatible License

- Permitted: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, Zlib
- Requires approval: MPL-2.0, LGPL
- Forbidden: AGPL, GPL, BUSL, proprietary, source-available without approval

### 3. Pinned Authority

- Exact version or commit must be recorded in Cargo.toml
- No floating versions (e.g., `*`, `>=1.0`)
- Cargo.lock must be committed for reproducible builds

### 4. Acceptable Transitive Dependency Impact

- Total transitive dependency count must be justified
- Each transitive dependency must be reviewed for license and security
- Duplicate dependencies (multiple versions of same crate) must be minimized

### 5. Acceptable Memory and Disk Cost

- Runtime memory overhead must be within resource budget (16 GB RAM target)
- Disk footprint must be within installation budget (~122 MiB for x86_64)
- Compilation time impact must be acceptable (<5 min additional build time)

### 6. No Duplication of Existing Capability

- Check existing dependencies before adding new ones
- Prefer extending existing dependencies over adding new ones
- Document why existing capabilities are insufficient

### 7. Security Review

- Check RustSec advisory database for known vulnerabilities
- Review crate source for unsafe code patterns
- Evaluate maintenance status and response to security issues
- Consider supply-chain attack surface

### 8. Maintenance Ownership

- Identify maintainer or team responsible for the dependency
- Document update frequency and breaking change policy
- Plan for dependency updates and migrations

### 9. Removal or Rollback Strategy

- Document how to remove the dependency if needed
- Identify replacement candidates or fallback implementations
- Ensure the dependency is not deeply coupled to core logic

## Admission Process

### Step 1: Proposal

Create an ADR (Architecture Decision Record) documenting:
- Problem statement
- Proposed dependency
- Alternatives considered
- Transitive dependency analysis
- Security review summary
- Resource impact assessment

### Step 2: Review

The proposal must be reviewed for:
- License compliance
- Security implications
- Resource budget impact
- Architecture fit
- Maintenance burden

### Step 3: Trial

If approved, add the dependency to a feature branch:
- Run full test suite
- Check for compilation warnings
- Measure resource impact
- Verify CI passes

### Step 4: Admission

If trial succeeds:
- Update Cargo.toml with exact version
- Update Cargo.lock
- Update resource adoption matrix
- Merge to main branch

### Step 5: Monitoring

After admission:
- Monitor RustSec advisories
- Track dependency updates
- Review transitive dependency changes
- Re-evaluate necessity periodically

## Forbidden Practices

- Adding a dependency without documented need
- Using floating versions or wildcards
- Ignoring transitive dependencies
- Skipping security review
- Adding duplicate functionality
- Using deprecated or unmaintained crates
- Adding crates with known vulnerabilities
- Ignoring license incompatibilities

## Rust-Specific Rules

### Feature Flags

- Disable default features unless explicitly needed
- Document which features are enabled and why
- Minimize feature flag sprawl

### Platform-Specific Dependencies

- Use `[target.'cfg(windows)'.dependencies]` for Windows-only crates
- Use `[target.'cfg(unix)'.dependencies]` for Unix-only crates
- Document platform-specific behavior

### Dev Dependencies

- Use `[dev-dependencies]` for test-only crates
- Dev dependencies must not leak into production builds
- Document test-only usage

### Build Dependencies

- Use `[build-dependencies]` for build-script crates
- Build dependencies must not affect runtime behavior
- Document build-time usage

## Dependency Categories

### Core Dependencies

- **serde/serde_json**: Serialization (M1)
- **sha2**: SHA-256 hashing (M1)
- **windows-sys**: Windows FFI (M2)

### Evaluated Dependencies

- **reqwest**: HTTP client (M2 Slice B)
- **tokio**: Async runtime (M2 Slice B)
- **thiserror**: Error types (M2 Slice B)

### Dev Dependencies

- **tempfile**: Temporary files for tests (M2)

## Compliance

This policy complies with:
- 11-OSS-ADOPTION-POLICY.md
- Protected architecture
- Resource budget constraints
- Security-first development

## Exceptions

Exceptions require:
- Documented justification
- Security review approval
- Resource budget approval
- Time-limited exception with review date
