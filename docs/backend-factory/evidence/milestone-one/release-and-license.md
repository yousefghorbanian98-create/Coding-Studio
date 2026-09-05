# Milestone One — Release Integrity and License

## License

- File: `LICENSE` at tag `v0.81.7` (commit `358226c2a35b8b50d4d520b3363b0dc60c000fdb`).
- Text: MIT License, `Copyright (c) 2025 Jeremy Huang` (verbatim header verified).
- GitHub API `license.spdx_id`: `MIT`.
- Conclusion: **MIT — adoption and compatibility-layer integration permitted.**
  No AGPL/BUSL/source-available conflict. Attribution requirement: none for a
  protocol-compatible independent implementation; upstream repository is
  credited in evidence and ADRs. No upstream code is copied into this
  repository.

## Selected release

| Field | Value |
|---|---|
| Tag | `v0.81.7` (annotated) |
| Tagged commit | `358226c2a35b8b50d4d520b3363b0dc60c000fdb` (ancestor of `master` tip `f11adb5996c541592e28519018709eebebc9fce4`) |
| Published | 2026-09-04T21:38:18Z |
| Release name | `GPT-6 Astra default` |
| Immutable asset base | `https://github.com/1jehuang/jcode/releases/download/v0.81.7/` |

## Release assets (metadata via GitHub API, verified 2026-09-05)

| Asset | Size (bytes) | Purpose |
|---|---|---|
| `jcode-windows-x86_64.exe` | 128,476,672 | Windows x86_64 binary (single-file executable) |
| `jcode-windows-x86_64.tar.gz` | 41,569,887 | same, tarred |
| `jcode-windows-aarch64.exe` | 80,173,056 | Windows ARM64 binary |
| `jcode-windows-aarch64.tar.gz` | 29,475,252 | same, tarred |
| `jcode-linux-x86_64.tar.gz` | 48,303,747 | Linux x86_64 |
| `jcode-linux-aarch64.tar.gz` | 49,358,319 | Linux ARM64 |
| `jcode-macos-x86_64.tar.gz` | 53,344,180 | macOS x86_64 |
| `jcode-macos-aarch64.tar.gz` | 50,528,535 | macOS ARM64 |
| `jcode-freebsd-x86_64.tar.gz` | 46,175,590 | FreeBSD x86_64 |
| `SHA256SUMS` | 836 | official checksum record |

Windows architecture mapping: `windows-x86_64` = x86_64 (required first
architecture); `windows-aarch64` = ARM64 (evidence tier documented in
`windows-evidence.md`).

## Official checksum record (supply-chain gate: PASS)

The sandbox could not execute binaries (Linux-only) and could not download
from `release-assets.githubusercontent.com`, but the byte-exact content of
`SHA256SUMS` was recovered through the immutable tag URL and **proven
byte-exact**: the reconstructed file (836 bytes, LF-terminated lines) hashes to
SHA-256 `733aebe30981a81c5d8205ac76b6d57399e4fbd4dc77ec1b371478dfe68cce0e`,
which is independently equal to the GitHub API asset `digest` field
(`repos/1jehuang/jcode/releases/tags/v0.81.7`, asset id 544965885).

Verbatim content (GNU `sha256sum -c` format, 64-hex + two spaces + name + LF):

```
6cdba698208f45ce2052f37b45fac2a5b901bd6c7b13969b2af3db1ec8fe6f2a  jcode-freebsd-x86_64.tar.gz
499b0a877f6d46d1b315a0d11e7ce9f6d8deea36f2f0b0d11d32296dbf9af017  jcode-linux-aarch64.tar.gz
e75d50fcbf729ed7a96d78e1970c2b10bacf7626e844a3eb7ca2c5f4ccf9590b  jcode-linux-x86_64.tar.gz
3256d24831ca1c0b3820a03a99d4c782fbc40f740260633dbc6e6a711d47fd7c  jcode-macos-aarch64.tar.gz
5761f53c2c15aa810f38ed6dfe00597ed75dda808243272e8c963ea5a4ad1d46  jcode-macos-x86_64.tar.gz
e38ed16c3fb3bae43989c4fe043da7e3240c24bcad95129fad059cf56636c05c  jcode-windows-aarch64.exe
bda9b2c78569a8c327c204b8735eb62615f208576616964fddcc014ee32fc5a7  jcode-windows-aarch64.tar.gz
b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b  jcode-windows-x86_64.exe
5c4ef586311e4cc131f7e311b74a7b7bc9dae8ee5cfd8cf1ab056fa8d19fcb8b  jcode-windows-x86_64.tar.gz
```

The integrity-verified copy also ships as the test fixture
`src-tauri/tests/fixtures/jcode/release/sha256sums-v0.81.7.txt` (provenance in
`src-tauri/tests/fixtures/jcode/PROVENANCE.md`).

- Checksum file format: GNU coreutils (`<64 lowercase hex><two spaces><name>\n`).
- Signatures: no `.sig`/`.asc` or minisign assets; **no Authenticode signature
  currently applied** (upstream `docs/WINDOWS.md`: "Release pipeline ready;
  requires the one-time Azure configuration"). The release workflow
  (`.github/workflows/release.yml`) contains the Azure Artifact Signing job
  and an explicit `WINDOWS_SIGNING_REQUIRED` guard. Conclusion: integrity rests
  on GitHub release immutability per tag + SHA256SUMS; signature verification
  becomes available once upstream enables Authenticode. This is **sufficient**
  for the pinned-version lauch policy because Coding Studio never executes a
  downloaded binary without an independently fetched official checksum match.
- Attestations: no GitHub artifact-attestation bundle observed on the release.
- Update verification behavior: `jcode update` verifies SHA-256 against
  `SHA256SUMS` before replacing binaries (upstream `docs/WINDOWS.md`,
  `crates/jcode-update-core/src/lib.rs`, `docs/backend-factory` sibling notes).

## Release workflow provenance

`.github/workflows/release.yml` at the tagged commit (924 lines), triggered by
`v*` tag push:

- `build-windows` matrix: `windows-latest` (`x86_64-pc-windows-msvc`) and
  `windows-11-arm` (`aarch64-pc-windows-msvc`) — native runners, not cross
  emulation, with a Windows install verification script
  (`.github/scripts/verify_windows_install.ps1`).
- Windows assets staged as unsigned artifacts, optionally Authenticode-signed
  through `azure/artifact-signing-action@v2` with GitHub OIDC (no exported
  private key); unsigned publication emits an explicit warning
  (`WINDOWS_SIGNING_REQUIRED=false` guard).
- `SHA256SUMS` generated in-workflow with Python `hashlib.sha256` over the
  built assets and uploaded before the release is made public.
- Per-platform assets are attached to a draft first, checksummed, then
  published (see also upstream `RELEASING.md`).

## Risks recorded

- Mutable-tag risk: acknowledged; Coding Studio pins tag **and** tagged commit
  **and** asset digests, and CI re-fetches checksums from the tag URL at probe
  time. A re-pointed tag would break the recorded digests and fail closed during
  Milestone Two managed-install verification.
- Old `v0.9.x` release line (April 2026) could be mistaken for "newer";
  neutralized by exact tag/commit pinning (`upstream-provenance.md`).
- Binary execution inside this sandbox was impossible (network-blocked asset
  host, Linux environment). Per mission policy, real-binary execution is
  deferred to the Windows CI probe (`.github/workflows/ci-windows.yml`,
  `jcode-release-probe` job), which downloads from the immutable tag URL,
  verifies SHA-256, and runs only non-authenticated commands
  (`jcode version --json`) in an isolated directory with telemetry disabled.
