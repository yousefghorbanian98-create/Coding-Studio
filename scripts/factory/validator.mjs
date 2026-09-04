import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REQUIRED_BASE_COMMIT = '710324911da56856ae6a67bdb2f24bbfe3031b87';
export const VALIDATOR_VERSION = '1.0.0';

export const REQUIRED_DOCS = [
  'docs/backend-factory/00-USER-DIRECTIVE.md',
  'docs/backend-factory/01-MASTER-MISSION.md',
  'docs/backend-factory/02-BACKEND-ROADMAP.md',
  'docs/backend-factory/03-ARCHITECTURE.md',
  'docs/backend-factory/04-REQUIREMENTS.md',
  'docs/backend-factory/05-ACCEPTANCE-MATRIX.md',
  'docs/backend-factory/06-TRACEABILITY-MATRIX.md',
  'docs/backend-factory/07-STATE-MACHINE.md',
  'docs/backend-factory/08-THREAT-MODEL.md',
  'docs/backend-factory/09-TEST-STRATEGY.md',
  'docs/backend-factory/10-N8N-RESEARCH-POLICY.md',
  'docs/backend-factory/11-OSS-ADOPTION-POLICY.md',
  'docs/backend-factory/12-SELF-HEAL-RUNBOOK.md',
  'docs/backend-factory/13-RECOVERY-RUNBOOK.md',
  'docs/backend-factory/14-PROVIDER-PLAN.md',
  'docs/backend-factory/15-RUFLO-PLAN.md',
];

export const REQUIRED_EVIDENCE = [
  'docs/backend-factory/evidence/stage-zero/finn-loop-research.md',
  'docs/backend-factory/evidence/stage-zero/n8n-research.md',
  'docs/backend-factory/evidence/stage-zero/taste-decision.md',
  'docs/backend-factory/evidence/stage-zero/oss-register.md',
  'docs/backend-factory/evidence/stage-zero/mission-review.md',
];

export const REQUIRED_MACHINE_FILES = [
  '.factory/manifest.json',
  '.factory/state.json',
  '.factory/journal.jsonl',
  '.factory/requirements.json',
  '.factory/stages.json',
];

export const REQUIRED_SCHEMAS = [
  '.factory/schemas/requirements.schema.json',
  '.factory/schemas/stages.schema.json',
  '.factory/schemas/state.schema.json',
  '.factory/schemas/manifest.schema.json',
];

export const CANONICAL_FROZEN_FILES = [
  ...REQUIRED_DOCS,
  ...REQUIRED_EVIDENCE,
  '.factory/requirements.json',
  '.factory/stages.json',
  ...REQUIRED_SCHEMAS,
].sort();

const MILESTONE_HEADINGS = {
  1: 'MILESTONE ONE',
  2: 'MILESTONE TWO',
  3: 'MILESTONE THREE',
  4: 'MILESTONE FOUR',
  5: 'MILESTONE FIVE',
  6: 'MILESTONE SIX',
  7: 'FUTURE MILESTONE SEVEN',
  8: 'FUTURE MILESTONE EIGHT',
};

const MILESTONE_LABELS = {
  1: 'Milestone One',
  2: 'Milestone Two',
  3: 'Milestone Three',
  4: 'Milestone Four',
  5: 'Milestone Five',
  6: 'Milestone Six',
  7: 'Future Milestone Seven',
  8: 'Future Milestone Eight',
};

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function readUtf8(root, relative) {
  return readFileSync(join(root, relative), 'utf8');
}

function readJson(root, relative) {
  return JSON.parse(readUtf8(root, relative));
}

function pathExists(root, relative) {
  return existsSync(join(root, relative));
}

function issue(code, message, file = null) {
  return { code, message, file };
}

function detectCycles(nodes, getNodeId, getDeps) {
  const visited = new Set();
  const stack = new Set();
  const result = [];
  function visit(id) {
    if (stack.has(id)) {
      result.push(id);
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    stack.add(id);
    for (const dep of getDeps(id)) {
      if (stack.has(dep)) {
        result.push(`${id}->${dep}`);
      } else {
        visit(dep);
      }
    }
    stack.delete(id);
  }
  for (const id of nodes) visit(id);
  return result;
}

function validateStateShape(state, file) {
  const issues = [];
  const types = {
    schemaVersion: 'string',
    runIdentifier: 'string',
    repository: 'string',
    branch: 'string',
    baseCommit: 'string',
    activeMilestone: 'integer',
    activeStage: 'string',
    activeGate: 'string',
    status: 'string',
    lastProgressTime: 'string',
    lastCommit: ['string', 'null'],
    lastCIrun: ['string', 'null'],
    completedStages: 'array',
    pendingStages: 'array',
    blockedStages: 'array',
    blockers: 'array',
  };
  for (const [key, expected] of Object.entries(types)) {
    const actual = state[key];
    const isNull = actual === null && Array.isArray(expected) && expected.includes('null');
    const ok = isNull
      ? true
      : Array.isArray(expected)
        ? !expected.includes('null') && expected.includes(typeof actual)
        : expected === 'array'
          ? Array.isArray(actual)
          : expected === 'integer'
            ? Number.isInteger(actual)
            : expected === 'string'
              ? typeof actual === 'string'
              : false;
    if (!ok) issues.push(issue('STATE_SCHEMA_INVALID', `${file}: field "${key}" is invalid (expected ${String(expected)})`, file));
  }
  const counters = state.attemptCounters;
  if (!counters || typeof counters !== 'object' || Array.isArray(counters)) {
    issues.push(issue('STATE_SCHEMA_INVALID', `${file}: field "attemptCounters" is invalid`, file));
  } else {
    for (const key of ['healingAttempts', 'ciRemediationAttempts', 'reviewAndFixRounds', 'noProgressIterations', 'identicalFailureFingerprints']) {
      if (!Number.isInteger(counters[key]) || counters[key] < 0) {
        issues.push(issue('STATE_SCHEMA_INVALID', `${file}: counter "${key}" is invalid`, file));
      }
    }
  }
  if (!/^[0-9a-f]{40}$/.test(state.baseCommit ?? '')) {
    issues.push(issue('STATE_SCHEMA_INVALID', `${file}: baseCommit must be a 40 hex commit`, file));
  }
  const allowedStatus = ['preflight', 'stage-zero', 'active', 'blocked', 'complete'];
  if (!allowedStatus.includes(state.status)) {
    issues.push(issue('STATE_SCHEMA_INVALID', `${file}: unknown status "${state.status}"`, file));
  }
  return issues;
}

function validateManifestShape(manifest, file) {
  const issues = [];
  for (const key of ['schemaVersion', 'repository', 'branch', 'baseCommit', 'generationTime', 'reviewStatus', 'validatorVersion']) {
    if (typeof manifest[key] !== 'string' || manifest[key].length === 0) {
      issues.push(issue('MANIFEST_SCHEMA_INVALID', `${file}: field "${key}" is invalid`, file));
    }
  }
  if (!Array.isArray(manifest.frozenFiles)) {
    issues.push(issue('MANIFEST_SCHEMA_INVALID', `${file}: field "frozenFiles" is invalid`, file));
  }
  if (!manifest.fileHashes || typeof manifest.fileHashes !== 'object' || Array.isArray(manifest.fileHashes)) {
    issues.push(issue('MANIFEST_SCHEMA_INVALID', `${file}: field "fileHashes" is invalid`, file));
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.baseCommit ?? '')) {
    issues.push(issue('MANIFEST_SCHEMA_INVALID', `${file}: baseCommit must be a 40 hex commit`, file));
  }
  if (!['pending', 'passed', 'failed'].includes(manifest.reviewStatus)) {
    issues.push(issue('MANIFEST_SCHEMA_INVALID', `${file}: unknown reviewStatus "${manifest.reviewStatus}"`, file));
  }
  return issues;
}

function validateRequirementShape(r, file) {
  const issues = [];
  const stringFields = ['identifier', 'title', 'description', 'kind', 'status', 'n8nResearch', 'ossProvenance'];
  for (const key of stringFields) {
    if (typeof r[key] !== 'string' || r[key].length === 0) {
      issues.push(issue('REQ_STRUCTURE_INVALID', `${file}: requirement "${r.identifier ?? ''}" field "${key}" is invalid`, file));
    }
  }
  if (typeof r.stage !== 'string' || r.stage.length === 0) {
    issues.push(issue('REQ_NO_STAGE', `${file}: requirement "${r.identifier ?? ''}" has no stage`, file));
  }
  if (!Number.isInteger(r.milestone) || r.milestone < 0 || r.milestone > 8) {
    issues.push(issue('REQ_NO_MILESTONE', `${file}: requirement "${r.identifier ?? ''}" has no milestone`, file));
  }
  if (typeof r.securitySensitive !== 'boolean') {
    issues.push(issue('REQ_STRUCTURE_INVALID', `${file}: requirement "${r.identifier ?? ''}" securitySensitive is invalid`, file));
  }
  if (!['planned', 'in-progress', 'complete', 'blocked'].includes(r.status)) {
    issues.push(issue('REQ_STRUCTURE_INVALID', `${file}: requirement "${r.identifier ?? ''}" status is invalid`, file));
  }
  if (!['factory', 'implementation', 'future'].includes(r.kind)) {
    issues.push(issue('REQ_STRUCTURE_INVALID', `${file}: requirement "${r.identifier ?? ''}" kind is invalid`, file));
  }
  if (!Array.isArray(r.acceptanceCriteria) || r.acceptanceCriteria.length === 0) {
    issues.push(issue('REQ_NO_ACCEPTANCE', `${file}: requirement "${r.identifier ?? ''}" has no acceptance criterion`, file));
  }
  const plannedTests = [
    ...(Array.isArray(r.plannedUnitTests) ? r.plannedUnitTests : []),
    ...(Array.isArray(r.plannedIntegrationTests) ? r.plannedIntegrationTests : []),
    ...(Array.isArray(r.plannedWindowsTests) ? r.plannedWindowsTests : []),
  ];
  if (plannedTests.length === 0) {
    issues.push(issue('REQ_NO_PLANNED_TEST', `${file}: requirement "${r.identifier ?? ''}" has no planned test`, file));
  }
  if (r.securitySensitive && (!Array.isArray(r.threats) || r.threats.length === 0)) {
    issues.push(issue('SECURITY_REQ_NO_THREAT', `${file}: security-sensitive requirement "${r.identifier ?? ''}" has no threat mapping`, file));
  }
  if (r.status === 'complete') {
    if (!Array.isArray(r.evidencePaths) || r.evidencePaths.length === 0) {
      issues.push(issue('COMPLETE_NO_EVIDENCE', `${file}: completed requirement "${r.identifier ?? ''}" has no evidence`, file));
    }
    if (r.kind === 'implementation') {
      if (typeof r.implementationCommit !== 'string' || r.implementationCommit.length === 0) {
        issues.push(issue('COMPLETE_IMPL_NO_COMMIT', `${file}: completed implementation "${r.identifier ?? ''}" has no commit`, file));
      }
      if (typeof r.ciRun !== 'string' || r.ciRun.length === 0) {
        issues.push(issue('COMPLETE_IMPL_NO_CI', `${file}: completed implementation "${r.identifier ?? ''}" has no CI run`, file));
      }
    }
  }
  return issues;
}

/**
 * Validate the Backend Factory mission rooted at rootDir.
 * @param {string} rootDir
 * @returns {{ok: boolean, issues: Array<{code:string, message:string, file?:string}>}}
 */
export function validateFactory(rootDir) {
  const issues = [];

  // Required documents and evidence.
  for (const file of [...REQUIRED_DOCS, ...REQUIRED_EVIDENCE]) {
    if (!pathExists(rootDir, file)) {
      issues.push(issue('DOC_MISSING', `required document missing: ${file}`, file));
    }
  }

  // Required machine files.
  for (const file of REQUIRED_MACHINE_FILES) {
    if (!pathExists(rootDir, file)) {
      issues.push(issue('MACHINE_FILE_MISSING', `required machine file missing: ${file}`, file));
    }
  }
  for (const file of REQUIRED_SCHEMAS) {
    if (!pathExists(rootDir, file)) {
      issues.push(issue('MACHINE_FILE_MISSING', `required schema missing: ${file}`, file));
    }
  }

  let requirements;
  let stages;
  let state;
  let manifest;
  try {
    requirements = readJson(rootDir, '.factory/requirements.json');
  } catch {
    issues.push(issue('INVALID_JSON', `.factory/requirements.json is invalid JSON`, '.factory/requirements.json'));
  }
  try {
    stages = readJson(rootDir, '.factory/stages.json');
  } catch {
    issues.push(issue('INVALID_JSON', `.factory/stages.json is invalid JSON`, '.factory/stages.json'));
  }
  try {
    state = readJson(rootDir, '.factory/state.json');
  } catch {
    issues.push(issue('INVALID_JSON', `.factory/state.json is invalid JSON`, '.factory/state.json'));
  }
  try {
    manifest = readJson(rootDir, '.factory/manifest.json');
  } catch {
    issues.push(issue('INVALID_JSON', `.factory/manifest.json is invalid JSON`, '.factory/manifest.json'));
  }

  if (state) {
    issues.push(...validateStateShape(state, '.factory/state.json'));
  }
  if (manifest) {
    issues.push(...validateManifestShape(manifest, '.factory/manifest.json'));
    for (const [key, value] of Object.entries(manifest.fileHashes ?? {})) {
      if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
        issues.push(issue('MANIFEST_SCHEMA_INVALID', `.factory/manifest.json: fileHashes["${key}"] is not a SHA-256 hex value`, '.factory/manifest.json'));
      }
    }
  }

  // Base commit correctness.
  if (state && state.baseCommit !== REQUIRED_BASE_COMMIT) {
    issues.push(issue('BASE_COMMIT_WRONG', `.factory/state.json baseCommit ${state.baseCommit} does not equal ${REQUIRED_BASE_COMMIT}`, '.factory/state.json'));
  }
  if (manifest && manifest.baseCommit !== REQUIRED_BASE_COMMIT) {
    issues.push(issue('BASE_COMMIT_WRONG', `.factory/manifest.json baseCommit ${manifest.baseCommit} does not equal ${REQUIRED_BASE_COMMIT}`, '.factory/manifest.json'));
  }
  if (manifest && manifest.repository !== 'yousefghorbanian98-create/Coding-Studio') {
    issues.push(issue('MANIFEST_MISMATCH', `.factory/manifest.json repository does not match the expected repository`, '.factory/manifest.json'));
  }

  // Requirements validation.
  if (requirements) {
    const reqList = requirements.requirements;
    if (!Array.isArray(reqList) || reqList.length === 0) {
      issues.push(issue('REQ_STRUCTURE_INVALID', `.factory/requirements.json requirements must be a non-empty array`, '.factory/requirements.json'));
    } else {
      const seen = new Set();
      for (const r of reqList) {
        if (seen.has(r.identifier)) {
          issues.push(issue('REQ_ID_DUPLICATED', `duplicate requirement identifier "${r.identifier}"`, '.factory/requirements.json'));
        }
        seen.add(r.identifier);
        issues.push(...validateRequirementShape(r, '.factory/requirements.json'));
      }
      for (let milestone = 1; milestone <= 6; milestone += 1) {
        if (!reqList.some((r) => r.milestone === milestone)) {
          issues.push(issue('MILESTONE_MISSING', `no requirement for backend milestone ${milestone}`, '.factory/requirements.json'));
        }
      }
    }
  }

  // Stages validation and dependency checks.
  if (stages) {
    const milestones = stages.milestones;
    if (!Array.isArray(milestones) || milestones.length === 0) {
      issues.push(issue('MILESTONE_MISSING', '.factory/stages.json milestones must be a non-empty array', '.factory/stages.json'));
    } else {
      for (let milestone = 1; milestone <= 6; milestone += 1) {
        if (!milestones.some((m) => m.number === milestone)) {
          issues.push(issue('MILESTONE_MISSING', `backend milestone ${milestone} is missing`, '.factory/stages.json'));
        }
      }
      const milestoneIds = milestones.map((m) => String(m.number));
      const depCycles = detectCycles(
        milestoneIds,
        (id) => id,
        (id) => {
          const m = milestones.find((x) => String(x.number) === id);
          return (m?.requires ?? []).map((n) => String(n));
        },
      );
      if (depCycles.length > 0) {
        issues.push(issue('MILESTONE_DEP_CYCLE', `milestone dependency cycle detected: ${depCycles.join(', ')}`, '.factory/stages.json'));
      }

      const allStages = milestones.flatMap((m) => m.stages ?? []);
      const stageIds = allStages.map((s) => s.id);
      const stageMap = new Map(allStages.map((s) => [s.id, s]));
      const stageCycles = detectCycles(
        stageIds,
        (id) => id,
        (id) => stageMap.get(id)?.dependsOn ?? [],
      );
      if (stageCycles.length > 0) {
        issues.push(issue('STAGE_DEP_CYCLE', `stage dependency cycle detected: ${stageCycles.join(', ')}`, '.factory/stages.json'));
      }

      for (const m of milestones) {
        for (const s of m.stages ?? []) {
          if (s.milestone !== m.number) {
            issues.push(issue('STAGE_STRUCTURE_INVALID', `stage "${s.id}" milestone does not match its parent milestone`, '.factory/stages.json'));
          }
          if (s.n8nResearchGate !== true) {
            issues.push(issue('STAGE_NO_N8N_GATE', `stage "${s.id}" has no n8n research gate`, '.factory/stages.json'));
          }
          if (s.changesUserFacingUi === true && (typeof s.tasteDecision !== 'string' || s.tasteDecision.length === 0)) {
            issues.push(issue('STAGE_NO_TASTE_DECISION', `UI-changing stage "${s.id}" has no Taste decision`, '.factory/stages.json'));
          }
        }
      }

      const futureMilestones = [7, 8];
      for (const number of futureMilestones) {
        const m = milestones.find((x) => x.number === number);
        if (!m) {
          issues.push(issue('FUTURE_STARTED_TOO_EARLY', `future milestone ${number} is missing from stages`, '.factory/stages.json'));
        } else if (m.status !== 'future') {
          issues.push(issue('FUTURE_STARTED_TOO_EARLY', `future milestone ${number} must stay status "future"`, '.factory/stages.json'));
        } else if (!(m.stages ?? []).every((s) => s.status === 'future' || s.status === 'blocked')) {
          issues.push(issue('FUTURE_STARTED_TOO_EARLY', `future milestone ${number} has a non-future stage`, '.factory/stages.json'));
        }
      }

      // Markdown and JSON milestone list agreement.
      const missionText = (!issues.some((i) => i.file === 'docs/backend-factory/01-MASTER-MISSION.md') && pathExists(rootDir, 'docs/backend-factory/01-MASTER-MISSION.md'))
        ? readUtf8(rootDir, 'docs/backend-factory/01-MASTER-MISSION.md')
        : '';
      const roadmapText = (!issues.some((i) => i.file === 'docs/backend-factory/02-BACKEND-ROADMAP.md') && pathExists(rootDir, 'docs/backend-factory/02-BACKEND-ROADMAP.md'))
        ? readUtf8(rootDir, 'docs/backend-factory/02-BACKEND-ROADMAP.md')
        : '';
      const missionUpper = missionText.toUpperCase();
      const roadmapUpper = roadmapText.toUpperCase();
      for (const [, heading] of Object.entries(MILESTONE_HEADINGS)) {
        if (!missionUpper.includes(heading)) {
          issues.push(issue('MARKDOWN_JSON_MILESTONE_MISMATCH', `01-MASTER-MISSION.md is missing ${heading}`, 'docs/backend-factory/01-MASTER-MISSION.md'));
        }
      }
      for (const [number, label] of Object.entries(MILESTONE_LABELS)) {
        const labelU = label.toUpperCase();
        if (!roadmapUpper.includes(labelU) && !roadmapUpper.includes(MILESTONE_HEADINGS[number])) {
          issues.push(issue('MARKDOWN_JSON_MILESTONE_MISMATCH', `02-BACKEND-ROADMAP.md is missing ${label}`, 'docs/backend-factory/02-BACKEND-ROADMAP.md'));
        }
        if (!roadmapUpper.includes(`M${number}`) && !roadmapUpper.includes(`| ${number} |`) && number !== '0') {
          issues.push(issue('MARKDOWN_JSON_MILESTONE_MISMATCH', `02-BACKEND-ROADMAP.md is missing milestone number ${number}`, 'docs/backend-factory/02-BACKEND-ROADMAP.md'));
        }
      }
    }
  }

  // Manifest staleness.
  if (manifest) {
    const frozen = [...(manifest.frozenFiles ?? [])].sort();
    if (JSON.stringify(frozen) !== JSON.stringify(CANONICAL_FROZEN_FILES)) {
      issues.push(issue('MANIFEST_STALE', 'manifest.frozenFiles does not match the canonical frozen file set', '.factory/manifest.json'));
    }
    for (const file of frozen) {
      if (!pathExists(rootDir, file)) {
        issues.push(issue('MANIFEST_STALE', `manifest lists missing frozen file ${file}`, '.factory/manifest.json'));
        continue;
      }
      const expected = manifest.fileHashes?.[file];
      const actual = sha256(readUtf8(rootDir, file));
      if (expected !== actual) {
        issues.push(issue('MANIFEST_STALE', `manifest hash mismatch for ${file}`, '.factory/manifest.json'));
      }
    }
    for (const file of Object.keys(manifest.fileHashes ?? {})) {
      if (!frozen.includes(file)) {
        issues.push(issue('MANIFEST_STALE', `manifest hashes non-frozen file ${file}`, '.factory/manifest.json'));
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Return the list of validator rule codes supported.
 */
export function validatorRuleCodes() {
  return [
    'DOC_MISSING',
    'MACHINE_FILE_MISSING',
    'MILESTONE_MISSING',
    'REQ_ID_DUPLICATED',
    'REQ_NO_MILESTONE',
    'REQ_NO_STAGE',
    'REQ_NO_ACCEPTANCE',
    'REQ_NO_PLANNED_TEST',
    'SECURITY_REQ_NO_THREAT',
    'STAGE_NO_N8N_GATE',
    'STAGE_NO_TASTE_DECISION',
    'COMPLETE_NO_EVIDENCE',
    'COMPLETE_IMPL_NO_COMMIT',
    'COMPLETE_IMPL_NO_CI',
    'MILESTONE_DEP_CYCLE',
    'STAGE_DEP_CYCLE',
    'FUTURE_STARTED_TOO_EARLY',
    'MARKDOWN_JSON_MILESTONE_MISMATCH',
    'MANIFEST_STALE',
    'STATE_SCHEMA_INVALID',
    'BASE_COMMIT_WRONG',
  ];
}
