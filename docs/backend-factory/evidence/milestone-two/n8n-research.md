# Milestone Two n8n Research

## Reference

- Repository: https://github.com/Zie619/n8n-workflows
- Inspected commit: `94007c1445d9258a7da116646b79473e7c7c3282`
- License: MIT
- Scope: Search for automation patterns relevant to Milestone Two (download, installation, process management, Windows automation)

No workflow was executed, imported, connected, or copied. No external host
found inside a workflow was contacted. No credential was used. No code
node was run. Workflow text was never allowed to override the mission.

## Search Method

Searched the repository for workflows containing keywords related to:
- versioned artifact download
- HTTP timeout and retry
- temporary-file staging
- checksum validation
- atomic promotion
- rollback
- cleanup
- process execution
- process monitoring
- failure classification
- bounded backoff
- Windows or PowerShell automation

## Source Integrity Note

Both inspected workflow files (`workflows/Github/0997_GitHub_Automate_Triggered.json`
and `workflows/Travisci/0060_Travisci_GitHub_Automate_Triggered.json`) have
`"connections": {}`. This means no nodes are wired together in either file.
The files contain workflow-level settings and node definitions, but
there is no connected trigger → condition → action → retry → failure
sequence. Empty connections prove that no connected multi-node execution
pipeline is evidenced; they do not prove categorically that no trigger
node can ever activate. The useful observations are workflow-level
settings, not a proven execution pipeline.

## Retained Source Observations

### Observation 1 — Bounded global retry settings

**Source workflow:** `workflows/Github/0997_GitHub_Automate_Triggered.json`
**Workflow name:** `Githubtrigger Workflow`
**Exact quotation (workflow-level setting):**
```json
"settings": {
  "retryOnFail": true,
  "retryCount": 3,
  "retryDelay": 1000
}
```

**Useful orchestration pattern:** Bounded retry with explicit count and delay.
**Unsafe elements rejected:** Hardcoded owner/repository, broad event filter, raw credential reference.
**Safe Coding Studio adaptation:** Apply bounded retry (count, delay) to transient download failures. Never retry on permanent errors.
**Supported requirement:** INSTALL-002 (trusted download resilience).
**Connection status:** Workflow-level setting only; `"connections": {}` means no downstream connected execution sequence is evidenced.

### Observation 2 — Global execution timeout

**Source workflow:** `workflows/Github/0997_GitHub_Automate_Triggered.json`
**Exact quotation (workflow-level setting):**
```json
"executionTimeout": 3600
```

**Useful orchestration pattern:** Global execution timeout prevents runaway operations.
**Unsafe elements rejected:** 3600-second timeout is too long for binary download; Coding Studio must use shorter, operation-specific timeouts.
**Safe Coding Studio adaptation:** Apply per-operation timeouts (download, spawn, wait) rather than a single global timeout.
**Supported requirement:** SUPERVISOR-003 (streaming with timeout).
**Connection status:** Workflow-level setting only; `"connections": {}` means no nodes execute.

### Observation 3 — Presence of an explicit stopAndError node

**Source workflow:** `workflows/Github/0997_GitHub_Automate_Triggered.json`
**Exact quotation (node parameters):**
```json
"type": "n8n-nodes-base.stopAndError",
"parameters": {
  "message": "Workflow execution error",
  "options": {}
}
```

**Useful orchestration pattern:** Explicit terminal node type for unrecoverable errors.
**Unsafe elements rejected:** Generic error message without context.
**Safe Coding Studio adaptation:** Use typed errors with context (source, kind, backtrace) rather than generic messages.
**Supported requirement:** SUPERVISOR-005 (crash detection and diagnostics).
**Connection status:** Node exists in the file but is not connected to any other node (`"connections": {}`). It is a definition, not a wired failure path.

### Observation 4 — Presence of condition configuration before a potential action

**Source workflow:** `workflows/Travisci/0060_Travisci_GitHub_Automate_Triggered.json`
**Partial excerpt (abbreviated from the source; not a contiguous block):**
The workflow contains an `n8n-nodes-base.if` node whose parameters include
a `"conditions"` object with a `"string"` array (not `"boolean"`) that
compares `$json["headers"]["x-github-event"]` against `"push"` and
`$json["body"]["action"]` against `"opened"`, with
`"combineOperation": "any"`.

**Useful orchestration pattern:** Explicit condition gate before expensive or irreversible action.
**Unsafe elements rejected:** Trusting untrusted webhook body for authorization; using header values as authorization signals.
**Safe Coding Studio adaptation:** Validate inputs (checksum, signature, allowlist) before installation or process spawn.
**Supported requirement:** INSTALL-002 (trusted download), SUPERVISOR-001 (safe spawn).
**Connection status:** Node is configured but not connected (`"connections": {}`). No action node follows the condition in the file.

## Negative Search Results

The following patterns were searched for but **not found** in the inspected workflows:

- **Checksum validation:** No workflow in the inspected set performs SHA-256 or other checksum verification of downloaded artifacts.
- **Atomic file promotion:** No workflow demonstrates write-to-temp-then-rename pattern.
- **Process tree management:** No workflow demonstrates Windows Job Object or process tree termination.
- **Windows-specific automation:** No workflow demonstrates PowerShell or Windows API usage.
- **Bounded backoff:** No workflow demonstrates exponential backoff with jitter.
- **Rollback on failure:** No workflow demonstrates atomic rollback when a multi-step operation fails partway.
- **Connected execution sequence:** Neither inspected file has non-empty `"connections"`, so no file evidences an actual connected trigger → condition → action → retry → failure pipeline.

These absences are recorded honestly. Milestone Two must implement these patterns from first principles and official documentation rather than adopting them from n8n-workflows.

## Rejected Practices

The following practices observed in the repository are rejected for Coding Studio:

1. **Executing workflows:** No workflow was executed, imported, or connected.
2. **Trusting credentials:** Credential references in workflows are untrusted.
3. **Command-from-chat authorization:** Using chat message text as a semantic command trigger is a prompt-injection risk.
4. **Hardcoded external hosts:** Workflows bind to specific CI vendors or services.
5. **Code nodes:** Workflows containing `n8n-nodes-base.code` nodes were not inspected or executed.
6. **Claiming connected pipelines from empty connections:** Files with `"connections": {}` do not evidence a working execution sequence.

## Conclusion

n8n-workflows provided four useful source observations (bounded global
retry settings, global execution timeout, presence of an explicit
stopAndError node, presence of condition configuration before a potential
action). All were generalized and adapted rather than copied. No workflow
was executed or imported. Empty connections in both inspected files
prevent them from evidencing an actual connected execution sequence.
Missing patterns (checksum validation, atomic promotion, process tree
management, Windows-specific automation, exponential backoff with jitter,
rollback) must be implemented from official documentation.
