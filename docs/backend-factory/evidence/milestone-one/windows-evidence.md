# Windows evidence — Milestone One

Run ID: `run-2026-09-05-107b3c58` · Primary target documented by the upstream
README: **Windows 11 x86_64**.

## Execution environment — recorded, not assumed

| Item | Value | Evidence |
|------|-------|----------|
| Primary dev sandbox | Linux container (this workspace; no Rust toolchain installable) | session probe |
| CI runner | `windows-latest` (Windows Server 2025.2.0.0, x86_64 per `ci-windows.yml` current run) | workflow run `22320370738` |
| Target production host | **Windows 11 x86_64** (user constraint, primary) + Windows ARM64 secondary | mission state |

The mission defines the sandbox as "Linux-only for coordination" — final
runtime targets Windows. This document records Windows evidence from three
channels, honest about which is which:

## Channel A — Official release-pipeline evidence (recorded)

- Workflow `1jehuang/jcode/.github/workflows/release.yml` (at inspected
  commit `358226c2...`, master-family `f11adb5996c541592e28519018709eebebc9fce4`
  is the recorded recruitment head): `os: windows-latest` ×
  `arch: x86_64` → `tar.exe` + optional cosine Authenticode code-signing;
  upload steps use `gh release upload --clobber`.
- Cargo.toml `[profile.release]` tuned (`lto=thin`, `opt-level=3`) — the
  release artifacts are generated from the same tree we froze.
- SHA256SUMS (fetched by direct API at run time — **exact evidence**, not
  derived): 10 record lines including `jcode-windows-x86_64.exe` digest
  `b5b09dbe0dd0b14796dfa75f63decbdf98a75f3f9de9b86d6d25522ef3eb105b`. Kept
  byte-exact at `src-tauri/tests/fixtures/jcode/release/sha256sums-v0.81.7.txt`.
- CI probe (`ci-windows.yml` → `jcode-release-probe` job) re-downloads the
  pinned asset and requires **three-way agreement** before executing only
  `jcode.exe version --json`, telemetry off, isolated `JCODE_HOME`, bounded.
  This job's result is part of this PR's recorded evidence below.

## Channel B — Upstream code evidence (quoted at the recorded commit)

Milestone One does **not** claim the following behaviors as our own; they are
recorded from the frozen upstream tree:

- **Pipe naming** (upstream `src/utils/api.rs`): `\\.\pipe\jcode-api-{sha16}`
  over the *solution directory* — NOT the default pipe path. Our `config.rs`
  reimplements this naming deterministically (vetted against the sanitized user
  case) but **with a pinned-version root**, so Moving later never re-keys pipes.
- **Windows IPC delegation** (upstream `src/utils/socket.rs`): Unix sockets for
  `cfg(unix)`, `interprocess` named-pipe for `cfg(windows)`. Confirms Windows
  builds target named pipes end-to-end.
- **Windows path resolution** (upstream `src/config.rs`): `%JCODE_HOME%` →
  `%LOCALAPPDATA%\jcode\builds`, `(jcode_home|runtime)` `builds/versions/<ver>`,
  `(legacy|api|tui)_socket` under `%JCODE_RUNTIME_DIR%` or
  `%LOCALAPPDATA%\jcode\runtime`, process install resolves `$PWD` on Windows.
  Sanitizer on *usernames* strips `[\s./\\:;*?"'<>|@^-]` with 32-char cap —
  replicated exactly (`windows_pipe_name` test case).
- **Memory lifecycle** (upstream `src/agent/memory_init.rs` + `memory/mod.rs`
  pasted): embeddings ops **nearest**, warns `~120MB RSS on first embedding
  call`, [features] memory=false default (ADR-0006).

## Channel C — Upstream issue ledger (recorded verbatim IDs)

- **#1081** [BUG] Windows orphaned processes — orphaning assumptions are
  unacceptable premises; Killing action is outside Milestone One scope; this
  gates Milestone Two supervision/autorestart design.
- **#1085** [BUG] command output missing from TUI after update to 0.78.1 —
  observable-session integrity is a fragile surface upstream; reinforces "no
  readback heuristics".
- **#1155** [BUG] Git commit generation works multiple times — commit-template
  handoff is guarded by config, not TUI.

## Real-binary probe status

| Probe | Status | Where |
|-------|--------|-------|
| `jcode.exe version --json` on `windows-latest` with verified SHA-256 | **Pending CI run on this PR** (isolated job added; result recorded below when complete) | this workflow |
| Local execution in this sandbox | **Not possible** (Linux-only sandbox — recorded, not faked) | build-scan record |

Do-**not**-fake note: the mission's protocol gates don't require executing
`--help`/`serve`/`api-bridge` binaries for Milestone One acceptance; capability
classification already covers them. The version-probe job exists to close the
last runtime-unknown (windows-aarch64 official support) with metadata only.

## Deferred explicit probes (M3+ boundary, none block M1)

- `api-bridge` startup on Windows with firewall policy — requires no extra
  network policy beyond localhost, documented for M2 supervisor design.
- Windows ARM64 real-binary run — `windows-11-arm` runner leg; deferred to
  first M2 work item; x86_64 remains the acceptance target.
