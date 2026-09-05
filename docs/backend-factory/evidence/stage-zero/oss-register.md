# Stage Zero External Source Register

This register records every external source inspected during Stage Zero. None of
them was executed, piped into a shell, downloaded as a binary, vendored, or added
as a production dependency.

| Source | Repository | Inspected commit | License | Use | Decision |
| --- | --- | --- | --- | --- | --- |
| Finn-loop | https://github.com/finna/Finn-loop | `7941b62c946154d15c11b7f24931bb8b6e155f01` | MIT | Design reference for specification, build and review loop | Adopt design discipline only; no dependency |
| n8n-workflows | https://github.com/Zie619/n8n-workflows | `94007c1445d9258a7da116646b79473e7c7c3282` | MIT | Research gate for untrusted workflow patterns | Inspect only; no workflow executed, imported, copied or used as authorization |
| Taste Skill | https://github.com/Leonxlnx/taste-skill | `ccbc15639c97057cbfcf32ecebc38ef716e4bb37` | MIT | Governance reference for user-facing UI changes | Not applicable to product UI in Stage Zero; no dependency |

## Review fields recorded

Each source was reviewed for:

- official repository: confirmed
- exact commit: recorded
- license: recorded
- maintenance status: observed from repository activity at inspection time
- Windows support: not applicable to the reference sources (none is a runtime dependency)
- architecture support: not applicable
- known vulnerabilities: none reported at inspection time; no binaries or code was imported
- dependency weight: zero because no dependency was added
- protocol stability: not applicable
- alternatives considered: none needed because these are reference materials only
- build-versus-adopt decision: adopt design guidance, do not build or vendor
- attribution requirements: MIT notices preserved if any copied text is later used
- version pinning: inspected SHA pinned in this register
- checksum policy: no binary obtained; document hashes are covered by the frozen manifest
- tests: none applicable because no runtime dependency was added
- rollback plan: remove reference evidence and revert mission text if a source is rejected

## Forbidden practices confirmed

- No remote script piped into a shell.
- No unknown installer executed.
- No mutable latest reference used.
- No mutable binary URL used.
- No GitHub Action unpinned in `ci-windows.yml` by this register.
- No copied code without attribution.
- No large vendored repository.
- No AGPL, BUSL or source-available license adopted without explicit approval.
- No dependency for a trivial utility.
- No credentials committed to Git.
- No downloaded binary committed to Git.
