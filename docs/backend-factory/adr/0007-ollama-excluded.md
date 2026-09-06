# ADR-0007: Ollama and local model runtimes excluded

Status: accepted · Milestone One · 2026-09-05

## Decision

Ollama is never restored, exposed, configured, recommended, tested, or
depended on. No local model runtime enters the Coding Studio contract.

Upstream context: Jcode's Ollama references are confined to the OpenRouter
provider implementation's context-size probing
(`crates/jcode-provider-openrouter-runtime/src/ollama_context.rs`) and
provider metadata — i.e., a remote-provider catalog concern, not a local
runtime that Coding Studio could or should drive.

Enforcement in this milestone (all test-locked):

- `LifecycleCapabilities::product_facing()` contains no local-model or
  Ollama entry and structurally cannot grow one without editing tests that
  assert its exact denied set.
- Parsing a `model_info`/`runtime_info` event whose provider string names a
  local runtime (`ollama`, `localhost:11434`, `llama.cpp`, …) yields the
  `denied` capability class — never a selectable product capability.
- `Capability::LocalModelRuntime` and `Capability::OllamaProbe` are pinned as
  permanently `unsupported`.

## Consequences

- Provider traffic flows only through Jcode-managed remote providers behind
  the approval/permission boundary; no provider bypass and no local bypass.
