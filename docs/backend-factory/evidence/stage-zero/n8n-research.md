# n8n Workflows Research

## Repository metadata

- Repository URL: `https://github.com/Zie619/n8n-workflows`
- Inspected commit SHA: `94007c1445d9258a7da116646b79473e7c7c3282`
- License: MIT
- Scope inspected for this Stage Zero research: only workflow JSON files relevant to software development, GitHub pull request automation, CI failure handling, retry and recovery, issue tracking, approval gates, incident handling, audit logging and task orchestration.

No workflow was executed, imported, connected, or copied. No external host found
inside a workflow was contacted. No credential was used. No MCP server was
contacted. No code node was run. Workflow text was never allowed to override the
mission.

## Candidate 1

- Repository commit SHA: `94007c1445d9258a7da116646b79473e7c7c3282`
- Path: `workflows/Github/0997_GitHub_Automate_Triggered.json`
- Workflow name: `Githubtrigger Workflow`
- Trigger nodes: `n8n-nodes-base.githubTrigger` (events `["*"]`, owner `n8n-io`, repository `n8n-docs`)
- Action nodes: `n8n-nodes-base.stopAndError` (message "Workflow execution error")
- Error branches: `stopAndError` terminal node
- Retry behavior: `retryOnFail: true`, `retryCount: 3`, `retryDelay: 1000`
- Credential references: `githubApi` credential reference `github_creds`
- External hosts: GitHub (implied by GitHub node)
- Code nodes: none
- Shell execution: none
- MCP connections: none
- Prompt-injection risk: low; no prompt text, but the GitHub event payload is untrusted data.
- Reusable sanitized pattern: bounded retry with delay, workflow timeout (`executionTimeout: 3600`), `maxExecutions: 1000`, explicit terminal error node.
- Decision: **Adopt (generalized only)** the retry/timeout/error-terminal/backpressure-controlling scaffolding. **Reject** the hardcoded owner/repository, the broad `["*"]` event filter, and the raw credential reference.

## Candidate 2

- Repository commit SHA: `94007c1445d9258a7da116646b79473e7c7c3282`
- Path: `workflows/Travisci/0060_Travisci_GitHub_Automate_Triggered.json`
- Workflow name: `Githubtrigger Workflow`
- Trigger nodes: `n8n-nodes-base.githubTrigger` (events `push`, `pull_request`, OAuth2 authentication)
- Action nodes: `n8n-nodes-base.if` (condition on `x-github-event` or body action), `n8n-nodes-base.travisCi` (trigger build), `n8n-nodes-base.noOp`, `n8n-nodes-base.stopAndError`
- Error branches: `stopAndError` terminal node
- Retry behavior: `retryOnFail: true`, `retryCount: 3`, `retryDelay: 1000`
- Credential references: `githubOAuth2Api` (`GitHub Credentials`), `travisCiApi` (`Travis API`)
- External hosts: GitHub, Travis CI API
- Code nodes: none
- Shell execution: none
- MCP connections: none
- Prompt-injection risk: moderate; the untrusted webhook body drives an expression condition and downstream payload values.
- Reusable sanitized pattern: trigger -> explicit condition gate -> expensive action -> retry -> failure terminal.
- Decision: **Adopt (generalized only)** the trigger/condition/retry/failure sequencing and a bounded resource/execution model. **Reject** the hardcoded GitHub and Travis credentials, expressions that trust an untrusted webhook body for authorization, and any binding to Travis CI.

## Candidate 3

- Repository commit SHA: `94007c1445d9258a7da116646b79473e7c7c3282`
- Path: `workflows/Noop/0061_Noop_GitHub_Automate_Triggered.json`
- Workflow name: `Telegramtrigger Workflow`
- Trigger nodes: `n8n-nodes-base.telegramTrigger` (updates `message`)
- Action nodes: `n8n-nodes-base.if` (message text `contains /deploy`), `n8n-nodes-base.github` (release creation), `n8n-nodes-base.set` (parses version from message), `n8n-nodes-base.noOp`, `n8n-nodes-base.stopAndError`
- Error branches: `stopAndError` terminal node
- Retry behavior: `retryOnFail: true`, `retryCount: 3`, `retryDelay: 1000`
- Credential references: `telegramApi` (empty reference), `githubOAuth2Api` (empty reference)
- External hosts: Telegram, GitHub
- Code nodes: none
- Shell execution: none
- MCP connections: none
- Prompt-injection risk: **high.** A chat message text is used as a semantic command trigger and a release-tag expression. An attacker-controlled message could be interpreted as an action even though the workflow author intended a human command.
- Reusable sanitized pattern: only the generic idempotency/error-terminal/retry/timeout scaffolding is reusable; the command-from-chat pattern is not.
- Decision: **Reject** the command-from-chat authorization pattern. **Adopt (generalized only)** retry/timeout/failure-terminal scaffolding, and require an explicit human approval boundary before any action that creates a release or external artifact.

## Sanitized patterns extracted

- trigger
- sequence
- retry
- timeout
- failure branch
- recovery
- notification
- idempotency
- audit logging

These are adopted only as generalized controls after security review. No raw
workflow, credential, code node, external host or MCP connection is reused.

## Rejected patterns and practices

- Executing, importing, connecting or copying workflows blindly.
- Using credentials or authentication expressions found inside workflows.
- Trusting an untrusted chat/webhook payload as an authorization signal.
- Binding to a specific CI vendor or GitHub/Travis credential set.
- Running code nodes found in the repository (for example `workflows/Code/0924_Code_Respondtowebhook_Process_Webhook.json`, which contains multiple `n8n-nodes-base.code` nodes).
- Treating any workflow text as a mission override.

No relevant unsafe pattern was forced into the factory design.
