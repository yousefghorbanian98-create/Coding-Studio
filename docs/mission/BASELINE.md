# Baseline audit — mission start

Commit `9e516df` · CI [33612304555](https://github.com/yousefghorbanian98-create/Coding-Studio/actions/runs/33612304555) (all green)

## Stack

Tauri 2 + React 19 + TypeScript (strict, `exactOptionalPropertyTypes`), Vite, Vitest +
Testing Library, Playwright, ESLint 9 flat config, Zustand, TanStack Router/Query,
Base UI, i18next (en/fa with RTL), Motion.

## Baseline test results

| Gate | Result |
| --- | --- |
| ESLint | green |
| `tsc -b` + e2e project | green |
| Vitest | 141 passed / 18 files |
| Playwright | green |
| `cargo test` | 25 passed |
| `tauri build` | green, artifact produced |

No pre-existing breakage.

## Ollama surface to remove

23 files match `ollama` case-insensitively.

**Delete outright**

- `src-tauri/src/ollama/` — `client.rs`, `error.rs`, `mod.rs`, `registry.rs`, `types.rs`
- `src-tauri/tests/ollama_client.rs`
- `src/services/ollama/` — all six modules and both test files
- `src/stores/ollama.ts` and its test
- `src/components/ollama/ConnectionBanner.tsx`

**Edit to remove references**

- `src-tauri/src/lib.rs` — module declaration, state, six command registrations
- `src-tauri/Cargo.toml` — `reqwest`, `tokio-util`, `futures-util`, `wiremock`
- `src/components/shell/AppShell.tsx`, `StatusBar.tsx`
- `src/components/chat/ChatArea.tsx`, `ModelSelector.tsx`
- `src/i18n/locales/{en,fa}.ts` — the `ollama.*` block
- `.github/workflows/ci-windows.yml` — comment text only

Endpoint constants (`127.0.0.1:11434`, `/api/version`, `/api/tags`, `/api/chat`) live only
inside the deleted Rust client and its tests.

## Keep and generalise

- `src/services/transport/` — `ChatTransport`, `TransportError`, SSE parser, mock transport.
  Provider-neutral already; becomes the low-level streaming primitive.
- `src/services/sessionStorage.ts` — versioned persistence with corrupt-data recovery.
- `src/stores/{chat,preferences,ui}.ts` — no Ollama coupling beyond the model id.
- Shell components, command palette, i18n infrastructure, `Icon`, `IconButton`, `Kbd`.
- The Rust cancellation registry pattern is reused conceptually for run cancellation.

## Replace

`src/mocks/models.ts` (vendor-flavoured mock catalogue) gives way to provider-neutral
descriptors served by the mock runtime.
