# Test Strategy

## Layers

1. **Deterministic mission validation.** `npm run validate:mission` succeeds only
   when every required document, machine file, milestone, requirement, threat
   mapping, gate, dependency and frozen hash is correct. It has no network
   dependency.
2. **Validator mutation tests.** Each validation rule is proven by starting with
   a valid fixture, mutating or removing the relevant field, proving failure,
   restoring and proving pass. Tests assert error codes and messages.
3. **Frontend unit and component tests.** Vitest + Testing Library against the
   mock runtime. No provider or real Jcode dependency.
4. **Playwright.** Drives the deterministic mock via scenario parameters.
5. **Rust tests.** `cargo test --all-features` in `src-tauri`.
6. **Tauri build.** `npm run tauri build -- --ci` produces the Windows bundle.
7. **Windows CI.** The authoritative gate for Playwright, Rust tests, Tauri
   build and Windows artifacts.

## Process

- No existing test may be skipped or weakened.
- A test timeout increase without new evidence is forbidden.
- A weakened assertion is forbidden.
- Deleting a failing test is forbidden.
- Every real defect requires a regression test proven red against the defect.
- A documentation-only status change is not progress.
- A retry without new evidence is not progress.

## Evidence

- `npm run validate:mission`, `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build` and `cargo test` are run locally.
- Local Playwright success is not claimed if the browser is unavailable.
- Windows CI is authoritative for Playwright, Rust tests, Tauri build and
  Windows artifacts.
