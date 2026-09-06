# ADR-0006: Local embeddings disabled by default

Status: accepted · Milestone One · 2026-09-05

## Context

The target machine has 4 GB GPU VRAM and **no local model runtime**; local
embeddings are disabled by default in Coding Studio. Upstream Jcode's optional
memory feature defaults to an in-process ONNX embedding model
(all-MiniLM-L6-v2, `crates/jcode-embedding`), gated by `[features] memory`
(default `true`) and `memory_embedding_backend` (default `"local"`, env
`JCODE_MEMORY_EMBEDDING_BACKEND`).

## Decision

Coding Studio's launch policy (`src-tauri/src/jcode/lifecycle.rs`,
`LaunchPolicy`) declares, and tests assert:

- telemetry **disabled** (`JCODE_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`;
  upstream honours both per `TELEMETRY.md`),
- memory feature **disabled** (`[features] memory = false`), which removes the
  local-embedding execution path,
- no embedding backend env var is set by Coding Studio (leaving a remote
  embedding base URL or model configured would be a policy violation),
- capability negotiation reports `memory`/`local_embeddings` as
  `unsupported` (denied) in the product-facing capability set.

## Consequences

- Milestone Two's launcher applies this policy when writing the managed
  instance config; the policy model and its invariants ship and are tested
  now.
- If a future product decision wants semantic memory, it requires a new ADR
  and explicit user consent; never implicit activation.
