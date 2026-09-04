# Ruflo Plan

Ruflo remains **optional**. It is an advanced orchestrator layered on Jcode and
is not a production runtime dependency.

## Preconditions

- official Ruflo repository verification
- license verification
- stable version selection
- supported Jcode integration boundary
- supported MCP or equivalent protocol
- prohibition on terminal scraping
- managed installation
- pinned version
- compatibility policy

## Orchestration scope

- agent roles
- task graph
- shared memory
- swarm lifecycle
- concurrency limits
- cancellation
- worker crash
- partial failure
- orchestration recovery
- provider cost controls
- resource controls
- audit trail
- approval boundary
- optional feature flag
- normal Jcode fallback
- Ruflo failure not blocking ordinary Jcode mode
- Windows validation
- default limits suitable for sixteen gigabytes of system memory

## Safety and integration boundary

Ruflo is behind an optional feature flag and disabled by default. Ordinary
Jcode mode works without Ruflo. Ruflo failure never blocks ordinary Jcode mode.
Ruflo never overrides backend architecture or security. Default limits must be
safe for a 16 GiB Windows host.
