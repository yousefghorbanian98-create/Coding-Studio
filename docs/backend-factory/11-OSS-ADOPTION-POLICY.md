# Open Source Adoption Policy

No open-source solution may be researched and adopted until it has a complete
provenance review. The review is recorded in `.factory/requirements.json` and in
`docs/backend-factory/evidence/stage-zero/oss-register.md`.

## Required review fields

For every proposed adoption include:

- official repository
- exact commit or version
- license
- maintenance status
- Windows support
- architecture support
- known vulnerabilities
- dependency weight
- protocol stability
- alternatives considered
- build-versus-adopt decision
- attribution requirements
- version pinning
- checksum policy
- tests
- rollback plan

## Forbidden practices

- piping a remote script into a shell
- executing an unknown installer
- mutable latest references
- mutable binary URLs
- unpinned GitHub Actions
- copied code without attribution
- large vendored repositories
- AGPL without explicit approval
- BUSL without explicit approval
- source-available licenses without explicit approval
- a dependency for a trivial utility
- credentials committed to Git
- downloaded binaries committed to Git

## Compliance

- No remote script may be piped directly into a shell.
- Mutable downloads, unpinned GitHub Actions, unattributed copied code and
  incompatible licenses are forbidden.
- Every adoption decision must be attributable and reversible.
