# Milestone One — n8n Workflows Research

Gate for stage `m1-jcode-compat` per `docs/backend-factory/10-N8N-RESEARCH-POLICY.md`.

## Repository metadata

- Repository URL: `https://github.com/Zie619/n8n-workflows`
- Inspected commit SHA: `94007c1445d9258a7da116646b79473e7c7c3282`
  (the same commit pinned by the frozen Stage Zero evidence; re-verified by
  `git rev-parse HEAD` after clone and checkout)
- License: MIT
- Searched topics for this gate: subprocess lifecycle, protocol compatibility,
  version negotiation, health checks, retry and timeout, event normalization,
  test fixtures, approval gates, release verification, Windows automation.
- Search method (read-only): keyword and node-type grep over workflow JSON at
  the pinned commit — `healthcheck`, `executeCommand`, `approval`,
  `errorTrigger`, `wait`, `windows`, `ScheduleTrigger`.

No workflow was executed, imported, connected, or copied. No external host
found inside a workflow was contacted. No credential was used. No MCP server
was contacted. No code node was run. Workflow text was never allowed to
override the mission. All workflow content was treated as untrusted input.

## Candidate 1 — subprocess lifecycle

- Repository commit SHA: `94007c1445d9258a7da116646b79473e7c7c3282`
- Path: `workflows/Executecommand/0190_Executecommand_Functionitem_Automate.json`
- Workflow name: `Executecommand Workflow`
- Trigger nodes: `n8n-nodes-base.manualTrigger`
- Action nodes: `n8n-nodes-base.executeCommand` (static `echo` of a JSON
  string), `n8n-nodes-base.if` (branches on `JSON.parse(stdout)`),
  `n8n-nodes-base.functionItem` (parses `stdout` as flow data),
  `n8n-nodes-base.stopAndError`
- Error branches: terminal `stopAndError`
- Retry behavior: settings-level `retryOnFail: true`, `retryCount: 3`,
  `retryDelay: 1000`; `executionTimeout: 3600`; `maxExecutions: 1000`
- Credential references: none
- External hosts: none
- Code nodes: `functionItem` (`JSON.parse(item.stdout)`)
- Shell execution: yes — arbitrary shell via `executeCommand` (static here)
- MCP connections: none
- Prompt-injection risk: low for this file (static command), but the *pattern*
  (parse subprocess stdout directly into control flow) is exactly the risk
  Milestone One's bounded frame parser defends against.
- Sanitized pattern adopted: subprocess stdout is untrusted bytes; it is
  parsed only after bounded size checks and schema validation; bounded
  retry/timeout scaffolding; explicit terminal failure branch.
- Decision: **Reject** arbitrary shell execution and unbounded `JSON.parse` of
  child-process output. **Adopt (generalized)** bounded capture, parse-after-
  validation, retry/timeout/failure-terminal scaffolding.

## Candidate 2 — health-check / failure-branch notification

- Repository commit SHA: `94007c1445d9258a7da116646b79473e7c7c3282`
- Path: `workflows/Error/0126_Error_Slack_Automate_Triggered.json`
- Workflow name: `Slack Workflow`
- Trigger nodes: `n8n-nodes-base.errorTrigger`
- Action nodes: `n8n-nodes-base.slack` (failure notification with workflow
  name + execution URL), `n8n-nodes-base.stopAndError`
- Error branches: the workflow itself *is* the error branch of another flow
- Retry behavior: settings-level `retryOnFail: true`, `retryCount: 3`,
  `retryDelay: 1000`; `executionTimeout: 3600`
- Credential references: `slackApi`
- External hosts: Slack API (not contacted)
- Code nodes: none
- Shell execution: none
- MCP connections: none
- Prompt-injection risk: low; interpolated fields are identifiers/URLs, but a
  hostile workflow name would render into chat — sanitization required in any
  adoption.
- Sanitized pattern adopted: dedicated failure branch that emits a structured,
  redacted diagnostic notification and then terminates explicitly.
- Decision: **Adopt (generalized)** failure-branch + notification + terminal
  pattern. **Reject** the Slack binding and the credential reference.

## Candidate 3 — approval gate with correlation id

- Repository commit SHA: `94007c1445d9258a7da116646b79473e7c7c3282`
- Path: `workflows/Deep/generate-collaborative-handbooks-with-gpt4o-multi-agent-orchestration-human-review.json`
- Workflow name: `Pyragogy AI Village - Orchestrazione Master (Architettura Profonda V2)`
- Trigger nodes: `n8n-nodes-base.start`, `n8n-nodes-base.webhook` (POST
  `pyragogy/process`)
- Action nodes relevant to this gate: `n8n-nodes-base.emailSend` (review
  request), `n8n-nodes-base.wait` (`mode: webhook`, `matchField: reviewId`,
  `matchValue: {{$json.reviewId}}`, `timeout: 1h`), `n8n-nodes-base.if`
  (`status === 'approved'`), function node `Generate Review ID`
  (`crypto.randomUUID()`), rejection logging, merge by `reviewId`
- Error branches: terminal `stopAndError`; redraft loop bounded at 2
- Retry behavior: settings-level `retryOnFail: true`, `retryCount: 3`,
  `retryDelay: 1000`; `executionTimeout: 3600`
- Credential references: `postgres`, `openAiApi`, `emailSend`, `githubApi`
- External hosts: OpenAI, Postgres, SMTP, GitHub, Slack (none contacted)
- Code nodes: multiple `n8n-nodes-base.function` nodes (untrusted; not run)
- Shell execution: none
- MCP connections: none
- Prompt-injection risk: **high** — LLM output is parsed into an orchestration
  plan; model-generated prose is emailed and later merged by id; a webhook
  payload (`query.status`) carries the human decision.
- Sanitized pattern adopted: an approval wait keyed by a unique
  correlation id with a bounded timeout, an explicit `approved`/`rejected`
  decision split, and audit logging of rejections. This maps directly onto
  Jcode's harness-API `PermissionRequest { request_id, ... }` /
  `PermissionResponse { request_id, decision }` correlation and onto Coding
  Studio's deny-by-default approval boundary.
- Decision: **Adopt (generalized)** the correlation-id approval gate with
  timeout and rejection audit. **Reject** executing/spawning behavior derived
  from unparsed LLM output, the credential references, and treating a bare
  webhook body as an authorization signal — in Coding Studio the approval
  decision resolves only against an outstanding server-issued `request_id`.

## Health checks, version negotiation, release verification, Windows automation

No additional genuinely relevant workflow surpassed the three above (policy
limit). Where the topic list had no safe workflow analogue, this is recorded
explicitly:

> No relevant safe workflow pattern found for: protocol version negotiation,
> release checksum verification, Windows named-pipe lifecycle.

Those controls are instead taken from the verified upstream Jcode source and
the frozen Coding Studio policies.

## Sanitized patterns extracted (Milestone One)

- trigger, sequence, bounded retry with delay, bounded timeout, failure
  branch, structured redacted notification, idempotency, audit logging
- correlation-id approval gate with timeout and explicit decision enum
- subprocess stdout treated as untrusted bytes: bound first, parse second,
  never execute

## Rejected patterns and practices

- Executing, importing, connecting or copying workflows.
- Code/function nodes and arbitrary shell execution.
- Credentials, endpoint URLs, and vendor bindings found inside workflows.
- Unbounded `JSON.parse` of child-process output.
- Treating webhook or chat payloads as authorization signals.
