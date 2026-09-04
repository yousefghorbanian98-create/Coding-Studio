import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const GENERATION_TIME = '2026-09-04';

function readJson(root, relative) {
  return JSON.parse(readFileSync(join(root, relative), 'utf8'));
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ').replaceAll(/\r/g, '');
}

function row(columns) {
  return `| ${columns.map(escapeCell).join(' | ')} |`;
}

function write(root, relative, content) {
  writeFileSync(join(root, relative), content, 'utf8');
}

function regen(root) {
  const requirements = readJson(root, '.factory/requirements.json').requirements;
  const stages = readJson(root, '.factory/stages.json').milestones;
  const threats = readJson(root, '.factory/threats.json').threats;

  const byMilestone = new Map();
  for (const r of requirements) {
    const key = String(r.milestone);
    if (!byMilestone.has(key)) byMilestone.set(key, []);
    byMilestone.get(key).push(r);
  }

  let reqDoc = `# Backend Factory Requirements

Machine readable source: \`.factory/requirements.json\`.
Status vocabulary: \`planned\`, \`in-progress\`, \`complete\`, \`blocked\`. No backend
implementation requirement is marked complete without reproducible evidence.

## Requirement count

Total: ${requirements.length} requirements.

`;
  const groupRows = (filter, sortKey) =>
    requirements
      .filter(filter)
      .sort((a, b) => String(a[sortKey]).localeCompare(String(b[sortKey])))
      .map((r) => row([r.identifier, r.title, `M${r.milestone}`, r.stage, r.status, r.kind]))
      .join('\n');

  const groups = [
    ['Stage Zero and cross-cutting', (r) => r.milestone === 0],
    ['Milestone One', (r) => r.milestone === 1],
    ['Milestone Two', (r) => r.milestone === 2],
    ['Milestone Three', (r) => r.milestone === 3],
    ['Milestone Four', (r) => r.milestone === 4],
    ['Milestone Five', (r) => r.milestone === 5],
    ['Milestone Six', (r) => r.milestone === 6],
    ['Future milestones', (r) => r.milestone === 7 || r.milestone === 8],
  ];
  for (const [title, filter] of groups) {
    reqDoc += `## ${title}\n\n| ID | Title | Milestone | Stage | Status | Kind |\n| --- | --- | --- | --- | --- | --- |\n`;
    const body = groupRows(filter, 'identifier');
    reqDoc += `${body || row(['None', '-', '-', '-', '-', '-'])}\n\n`;
  }
  write(root, 'docs/backend-factory/04-REQUIREMENTS.md', reqDoc);

  let acDoc = `# Acceptance Criteria Matrix

Generated from \`.factory/requirements.json\`. Each requirement lists its
acceptance criteria, non-goals and planned tests.

`;
  for (const r of requirements) {
    acDoc += `\n### ${r.identifier}: ${r.title}\n\n`;
    acDoc += `- Milestone: **M${r.milestone}** - Stage: **${r.stage}**\n`;
    acDoc += `- Status: **${r.status}** - Security sensitive: **${r.securitySensitive ? 'yes' : 'no'}**\n`;
    acDoc += `- Description: ${r.description}\n`;
    acDoc += `\nAcceptance criteria:\n\n`;
    r.acceptanceCriteria.forEach((c, i) => {
      acDoc += `- [ ] AC-${i + 1} - ${c}\n`;
    });
    acDoc += `\nNon-goals:\n\n`;
    (r.nonGoals.length ? r.nonGoals : ['None']).forEach((c) => {
      acDoc += `- ${c}\n`;
    });
    acDoc += `\nPlanned tests:\n\n`;
    const pts = [
      ...(r.plannedUnitTests ?? []),
      ...(r.plannedIntegrationTests ?? []),
      ...(r.plannedWindowsTests ?? []),
    ];
    if (pts.length === 0) {
      acDoc += `- None (documented).\n`;
    } else {
      pts.forEach((c) => {
        acDoc += `- ${c}\n`;
      });
    }
    acDoc += `\nThreats:\n\n`;
    (r.threats.length ? r.threats : ['None']).forEach((c) => {
      acDoc += `- ${c}\n`;
    });
    acDoc += `\nEvidence:\n\n`;
    (r.evidencePaths.length ? r.evidencePaths : ['No evidence yet (planned).']).forEach((c) => {
      acDoc += `- ${c}\n`;
    });
    acDoc += `\n`;
  }
  write(root, 'docs/backend-factory/05-ACCEPTANCE-MATRIX.md', acDoc);

  const milestoneTitle = (n) => {
    const m = stages.find((x) => x.number === n);
    return m ? m.title : 'Stage Zero / Cross-cutting';
  };
  let trDoc = `# Traceability Matrix

Generated from \`.factory/requirements.json\` and \`.factory/stages.json\`.
Every requirement maps through the complete chain:
Requirement -> Milestone -> Stage -> Acceptance criteria -> Threats -> Planned
implementation -> Planned tests -> Evidence -> Commit -> CI run -> Status.

| Requirement | Milestone | Stage | Acceptance | Non-goals | Threats | Planned impl | Planned tests | Evidence | Commitment date | Commit | CI run | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
`;
  for (const r of requirements) {
    const ac = r.acceptanceCriteria.map((c, i) => `AC-${i + 1}:${c}`).join('; ');
    const tests = [...(r.plannedUnitTests ?? []), ...(r.plannedIntegrationTests ?? []), ...(r.plannedWindowsTests ?? [])].join('; ') || 'None';
    trDoc +=
      row([
        r.identifier,
        `M${r.milestone} ${milestoneTitle(r.milestone)}`,
        r.stage,
        ac,
        r.nonGoals.join('; ') || 'None',
        r.threats.join('; ') || 'None',
        r.implementationFiles.join('; ') || 'None',
        tests,
        r.evidencePaths.join('; ') || 'None',
        r.status === 'complete' ? GENERATION_TIME : 'N/A',
        r.implementationCommit || 'TBD',
        r.ciRun || 'TBD',
        r.status,
      ]) + '\n';
  }
  write(root, 'docs/backend-factory/06-TRACEABILITY-MATRIX.md', trDoc);

  let threatDoc = `# Backend Factory Threat Model

A \`THR-*\` identifier names a threat. Every security-sensitive requirement
maps to at least one threat in \`.factory/requirements.json\`. Storage of the
mapping in the machine-readable mission is verified by
\`scripts/factory/validate-mission.mjs\`. This document is generated from
\`.factory/threats.json\`; the validator compares it with the catalog.

## Threat register

| ID | Title | Description | Primary controls |
| --- | --- | --- | --- |
`;
  for (const threat of threats) {
    threatDoc += row([threat.id, threat.title, threat.description, threat.controls]) + '\n';
  }
  threatDoc += `\n## How threats are used

- A requirement marked \`securitySensitive\` must reference at least one threat.
- Every threat above is referenced by at least one requirement.
- Adding or removing a threat is a mission change and requires an ADR plus a
  manifest update.
`;
  write(root, 'docs/backend-factory/08-THREAT-MODEL.md', threatDoc);
}

const root = resolve(process.argv[2] ?? process.cwd());
regen(root);
console.log(`Regenerated mission docs under ${root}`);
