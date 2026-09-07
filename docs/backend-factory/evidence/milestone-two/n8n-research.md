# Milestone Two n8n Research

## Reference

- Repository: https://github.com/Zie619/n8n-workflows
- Inspected commit: `94007c1445d9258a7da116646b79473e7c7c3282`
- License: MIT
- Scope: Search for automation patterns relevant to Milestone Two (download, installation, process management, Windows automation)

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

## Patterns Found

### Pattern 1 — Retry with bounded count and delay

**Source workflow:** `workflows/Github/0997_GitHub_Automate_Triggered.json`
**Workflow name:** `Githubtrigger Workflow`
**Exact quotation:**
```json
"retryOnFail": true,
"retryCount": 3,
"retryDelay": 1000
```

**Useful orchestration pattern:** Bounded retry with explicit count and delay.
**Unsafe elements rejected:** Hardcoded owner/repository, broad event filter, raw credential reference.
**Safe Coding Studio adaptation:** Apply bounded retry (count, delay) to transient download failures. Never retry on permanent errors.
**Supported requirement:** INSTALL-002 (trusted download resilience).

### Pattern 2 — Execution timeout

**Source workflow:** `workflows/Github/0997_GitHub_Automate_Triggered.json`
**Exact quotation:**
```json
"executionTimeout": 3600
```

**Useful orchestration pattern:** Global execution timeout prevents runaway operations.
**Unsafe elements rejected:** 3600-second timeout is too long for binary download; Coding Studio must use shorter, operation-specific timeouts.
**Safe Coding Studio adaptation:** Apply per-operation timeouts (download, spawn, wait) rather than a single global timeout.
**Supported requirement:** SUPERVISOR-003 (streaming with timeout).

### Pattern 3 — Explicit failure terminal

**Source workflow:** `workflows/Github/0997_GitHub_Automate_Triggered.json`
**Exact quotation:**
```json
"type": "n8n-nodes-base.stopAndError",
"parameters": {
  "errorMessage": "Workflow execution error"
}
```

**Useful orchestration pattern:** Explicit terminal node for unrecoverable errors.
**Unsafe elements rejected:** Generic error message without context.
**Safe Coding Studio adaptation:** Use typed errors with context (source, kind, backtrace) rather than generic messages.
**Supported requirement:** SUPERVISOR-005 (crash detection and diagnostics).

### Pattern 4 — Condition gate before expensive action

**Source workflow:** `workflows/Travisci/0060_Travisci_GitHub_Automate_Triggered.json`
**Exact quotation:**
```json
"type": "n8n-nodes-base.if",
"parameters": {
  "conditions": {
    "boolean": [
      {
        "value1": "={{$json[\"x-github-event\"]}}",
        "value2": "push"
      }
    ]
  }
}
```

**Useful orchestration pattern:** Explicit condition gate before expensive or irreversible action.
**Unsafe elements rejected:** Trusting untrusted webhook body for authorization.
**Safe Coding Studio adaptation:** Validate inputs (checksum, signature, allowlist) before installation or process spawn.
**Supported requirement:** INSTALL-002 (trusted download), SUPERVISOR-001 (safe spawn).

### Pattern 5 — Trigger → sequence → retry → failure terminal

**Source workflow:** `workflows/Travisci/0060_Travisci_GitHub_Automate_Triggered.json`
**Exact quotation:** Workflow connects trigger node → condition node → action node → retry policy → error terminal.

**Useful orchestration pattern:** Linear sequence with retry and explicit failure handling.
**Unsafe elements rejected:** Binding to specific CI vendor or credential set.
**Safe Coding Studio adaptation:** Structure download and installation as: validate input → download with retry → verify checksum → atomic install → error terminal.
**Supported requirement:** INSTALL-001, INSTALL-002 (managed installation sequence).

## Negative Search Results

The following patterns were searched for but **not found** in the inspected workflows:

- **Checksum validation:** No workflow in the inspected set performs SHA-256 or other checksum verification of downloaded artifacts.
- **Atomic file promotion:** No workflow demonstrates write-to-temp-then-rename pattern.
- **Process tree management:** No workflow demonstrates Windows Job Object or process tree termination.
- **Windows-specific automation:** No workflow demonstrates PowerShell or Windows API usage.
- **Bounded backoff:** No workflow demonstrates exponential backoff with jitter.
- **Rollback on failure:** No workflow demonstrates atomic rollback when a multi-step operation fails partway.

These absences are recorded honestly. Milestone Two must implement these patterns from first principles and official documentation rather than adopting them from n8n-workflows.

## Rejected Practices

The following practices observed in the repository are rejected for Coding Studio:

1. **Executing workflows:** No workflow was executed, imported, or connected.
2. **Trusting credentials:** Credential references in workflows are untrusted.
3. **Command-from-chat authorization:** Using chat message text as a semantic command trigger is a prompt-injection risk.
4. **Hardcoded external hosts:** Workflows bind to specific CI vendors or services.
5. **Code nodes:** Workflows containing `n8n-nodes-base.code` nodes were not inspected or executed.

## Conclusion

n8n-workflows provided five useful orchestration patterns (bounded retry,
execution timeout, explicit failure terminal, condition gate before
expensive action, linear sequence with retry and failure handling). All
were generalized and adapted rather than copied. No workflow was executed
or imported. Missing patterns (checksum validation, atomic promotion,
process tree management, Windows-specific automation, exponential backoff
with jitter, rollback) must be implemented from official documentation.
