import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';

export const REQUIRED_BASE_COMMIT = '710324911da56856ae6a67bdb2f24bbfe3031b87';
export const VALIDATOR_VERSION = '1.2.0';

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
  '.factory/threats.json',
];

export const REQUIRED_SCHEMAS = [
  '.factory/schemas/requirements.schema.json',
  '.factory/schemas/stages.schema.json',
  '.factory/schemas/state.schema.json',
  '.factory/schemas/manifest.schema.json',
  '.factory/schemas/threats.schema.json',
];

export const CANONICAL_FROZEN_FILES = [
  ...REQUIRED_DOCS,
  ...REQUIRED_EVIDENCE,
  '.factory/requirements.json',
  '.factory/stages.json',
  '.factory/threats.json',
  ...REQUIRED_SCHEMAS,
].sort();

// One authoritative rule-code inventory. Every code emitted by the validator
// MUST be present here, and every code here MUST be covered by a mutation test.
export const RULE_CODES = [
  'DOC_MISSING',
  'MACHINE_FILE_MISSING',
  'INVALID_JSON',
  'REQ_SCHEMA_INVALID',
  'STAGES_SCHEMA_INVALID',
  'STATE_SCHEMA_INVALID',
  'MANIFEST_SCHEMA_INVALID',
  'THREAT_SCHEMA_INVALID',
  'MANIFEST_MISMATCH',
  'MILESTONE_MISSING',
  'MILESTONE_DUPLICATE',
  'MILESTONE_DEP_MISSING',
  'MILESTONE_DEP_CYCLE',
  'STAGE_ID_DUPLICATE',
  'STAGE_DEP_MISSING',
  'STAGE_DEP_CYCLE',
  'STAGE_STRUCTURE_INVALID',
  'STAGE_NO_N8N_GATE',
  'STAGE_NO_TASTE_DECISION',
  'FUTURE_STARTED_TOO_EARLY',
  'REQ_ID_DUPLICATED',
  'REQ_NO_MILESTONE',
  'REQ_NO_STAGE',
  'REQ_STAGE_MISSING',
  'REQ_STAGE_MILESTONE_MISMATCH',
  'REQ_DEP_MISSING',
  'REQ_DEP_CYCLE',
  'REQ_NO_ACCEPTANCE',
  'REQ_NO_PLANNED_TEST',
  'SECURITY_REQ_NO_THREAT',
  'THREAT_ID_DUPLICATE',
  'THREAT_MISSING',
  'THREAT_UNREFERENCED',
  'THREAT_DOC_MISMATCH',
  'STAGE_ACC_REF_MISSING',
  'STAGE_ACC_REQ_MISASSIGNED',
  'STAGE_ACC_REQ_DUPLICATE',
  'STAGE_ACC_MISSING_REQUIREMENT',
  'COMPLETE_NO_EVIDENCE',
  'COMPLETE_EVIDENCE_PATH_MISSING',
  'COMPLETE_IMPL_FILE_MISSING',
  'COMPLETE_IMPL_NO_COMMIT',
  'COMPLETE_IMPL_NO_CI',
  'IMPL_COMMIT_INVALID',
  'CI_RUN_INVALID',
  'MARKDOWN_JSON_MILESTONE_MISMATCH',
  'MANIFEST_STALE',
  'BASE_COMMIT_WRONG',
];

const KNOWN_RULE_CODES = new Set(RULE_CODES);

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

const SCHEMA_VALIDATORS = [
  { dataFile: '.factory/requirements.json', schemaFile: '.factory/schemas/requirements.schema.json', code: 'REQ_SCHEMA_INVALID' },
  { dataFile: '.factory/stages.json', schemaFile: '.factory/schemas/stages.schema.json', code: 'STAGES_SCHEMA_INVALID' },
  { dataFile: '.factory/state.json', schemaFile: '.factory/schemas/state.schema.json', code: 'STATE_SCHEMA_INVALID' },
  { dataFile: '.factory/manifest.json', schemaFile: '.factory/schemas/manifest.schema.json', code: 'MANIFEST_SCHEMA_INVALID' },
  { dataFile: '.factory/threats.json', schemaFile: '.factory/schemas/threats.schema.json', code: 'THREAT_SCHEMA_INVALID' },
];

const COMMIT_RE = /^[0-9a-f]{40}$/;
const CI_RUN_RE = /^(?:[0-9]+|https:\/\/github\.com\/.+\/actions\/runs\/[0-9]+)$/;

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
  if (!KNOWN_RULE_CODES.has(code)) {
    throw new Error(`Unknown validator rule code: ${code}`);
  }
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

function validateSchemas(root, issues) {
  for (const { dataFile, schemaFile, code } of SCHEMA_VALIDATORS) {
    if (!pathExists(root, dataFile) || !pathExists(root, schemaFile)) continue;
    let validate;
    try {
      const text = readUtf8(root, schemaFile);
      const schema = JSON.parse(text);
      const ajv = new Ajv2020({ allErrors: true, strict: false });
      validate = ajv.compile(schema);
    } catch (error) {
      issues.push(issue(code, `${schemaFile} schema compile failed: ${error.message ?? error}`, dataFile));
      continue;
    }
    let data;
    try {
      data = readJson(root, dataFile);
    } catch {
      // Invalid data JSON is reported separately with INVALID_JSON.
      continue;
    }
    if (!validate(data)) {
      for (const error of validate.errors ?? []) {
        issues.push(
          issue(
            code,
            `${dataFile}${error.instancePath || ''}: ${error.message ?? 'invalid'} (${error.keyword ?? 'schema'})${
              error.params && typeof error.params.allowedValues !== 'undefined'
                ? ` allowed=${JSON.stringify(error.params.allowedValues)}`
                : ''
            }`,
            dataFile,
          ),
        );
      }
    }
  }
}

function checkArrayNonEmpty(value, code, message, file) {
  if (!Array.isArray(value) || value.length === 0) {
    return [issue(code, message, file)];
  }
  return [];
}

function collectPlannedTests(r) {
  return [
    ...(Array.isArray(r.plannedUnitTests) ? r.plannedUnitTests : []),
    ...(Array.isArray(r.plannedIntegrationTests) ? r.plannedIntegrationTests : []),
    ...(Array.isArray(r.plannedWindowsTests) ? r.plannedWindowsTests : []),
  ];
}

function validateRequirementSemantics(r, file, issues) {
  if (!Number.isInteger(r.milestone)) {
    issues.push(issue('REQ_NO_MILESTONE', `${file}: requirement "${r.identifier ?? ''}" has no milestone`, file));
  }
  if (typeof r.stage !== 'string' || r.stage.length === 0) {
    issues.push(issue('REQ_NO_STAGE', `${file}: requirement "${r.identifier ?? ''}" has no stage`, file));
  }
  if (!Array.isArray(r.acceptanceCriteria) || r.acceptanceCriteria.length === 0) {
    issues.push(issue('REQ_NO_ACCEPTANCE', `${file}: requirement "${r.identifier ?? ''}" has no acceptance criterion`, file));
  }
  if (collectPlannedTests(r).length === 0) {
    issues.push(issue('REQ_NO_PLANNED_TEST', `${file}: requirement "${r.identifier ?? ''}" has no planned test`, file));
  }
  if (r.securitySensitive === true && (!Array.isArray(r.threats) || r.threats.length === 0)) {
    issues.push(issue('SECURITY_REQ_NO_THREAT', `${file}: security-sensitive requirement "${r.identifier ?? ''}" has no threat mapping`, file));
  }
  if (r.status === 'complete') {
    if (!Array.isArray(r.evidencePaths) || r.evidencePaths.length === 0) {
      issues.push(issue('COMPLETE_NO_EVIDENCE', `${file}: completed requirement "${r.identifier ?? ''}" has no evidence`, file));
    }
    if (typeof r.implementationCommit === 'string' && r.implementationCommit.length > 0 && !COMMIT_RE.test(r.implementationCommit)) {
      issues.push(issue('IMPL_COMMIT_INVALID', `${file}: completed requirement "${r.identifier ?? ''}" implementationCommit "${r.implementationCommit}" is not a 40 hex commit`, file));
    }
    if (typeof r.ciRun === 'string' && r.ciRun.length > 0 && !CI_RUN_RE.test(r.ciRun)) {
      issues.push(issue('CI_RUN_INVALID', `${file}: completed requirement "${r.identifier ?? ''}" ciRun "${r.ciRun}" is not a valid run id or GitHub run URL`, file));
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
}

function validateRequirementGraph(root, reqList, reqMap, stageMap, threatIds, issues) {
  const reqIds = reqList.map((r) => r.identifier);
  const seen = new Set();
  const requirementCycles = detectCycles(reqIds, (id) => id, (id) => reqMap.get(id)?.dependencies ?? []);
  if (requirementCycles.length > 0) {
    issues.push(issue('REQ_DEP_CYCLE', `requirement dependency cycle detected: ${requirementCycles.join(', ')}`, '.factory/requirements.json'));
  }
  for (const r of reqList) {
    if (seen.has(r.identifier)) {
      issues.push(issue('REQ_ID_DUPLICATED', `duplicate requirement identifier "${r.identifier}"`, '.factory/requirements.json'));
    }
    seen.add(r.identifier);

    validateRequirementSemantics(r, '.factory/requirements.json', issues);

    for (const dep of r.dependencies ?? []) {
      if (!reqMap.has(dep)) {
        issues.push(issue('REQ_DEP_MISSING', `requirement "${r.identifier}" depends on missing requirement "${dep}"`, '.factory/requirements.json'));
      }
    }
    const stage = stageMap.get(r.stage);
    if (!stage) {
      issues.push(issue('REQ_STAGE_MISSING', `requirement "${r.identifier}" references missing stage "${r.stage}"`, '.factory/requirements.json'));
    } else if (stage.milestone !== r.milestone) {
      issues.push(issue('REQ_STAGE_MILESTONE_MISMATCH', `requirement "${r.identifier}" milestone M${r.milestone} does not match stage "${r.stage}" milestone M${stage.milestone}`, '.factory/requirements.json'));
    }
    for (const threat of r.threats ?? []) {
      if (!threatIds.has(threat)) {
        issues.push(issue('THREAT_MISSING', `requirement "${r.identifier}" references unknown threat "${threat}"`, '.factory/requirements.json'));
      }
    }
    if (r.status === 'complete') {
      for (const path of r.implementationFiles ?? []) {
        if (!pathExists(root, path)) {
          issues.push(issue('COMPLETE_IMPL_FILE_MISSING', `completed requirement "${r.identifier}" implementation file "${path}" does not exist`, '.factory/requirements.json'));
        }
      }
      for (const path of r.evidencePaths ?? []) {
        if (!pathExists(root, path)) {
          issues.push(issue('COMPLETE_EVIDENCE_PATH_MISSING', `completed requirement "${r.identifier}" evidence path "${path}" does not exist`, '.factory/requirements.json'));
        }
      }
    }
  }
}

function validateStagesGraph(root, stages, stageMap, reqMap, issues) {
  const milestones = stages.milestones;
  const milestoneNumbers = milestones.map((m) => m.number);
  const seenMilestones = new Set();
  for (const m of milestones) {
    if (seenMilestones.has(m.number)) {
      issues.push(issue('MILESTONE_DUPLICATE', `duplicate milestone number ${m.number}`, '.factory/stages.json'));
    }
    seenMilestones.add(m.number);
  }

  const milestoneById = new Map(milestones.map((m) => [m.number, m]));
  for (const m of milestones) {
    for (const dep of m.requires ?? []) {
      if (!milestoneById.has(dep)) {
        issues.push(issue('MILESTONE_DEP_MISSING', `milestone ${m.number} requires missing milestone ${dep}`, '.factory/stages.json'));
      }
    }
  }
  const milestoneCycle = detectCycles(
    milestoneNumbers.map(String),
    (id) => id,
    (id) => (milestoneById.get(Number(id))?.requires ?? []).map(String),
  );
  if (milestoneCycle.length > 0) {
    issues.push(issue('MILESTONE_DEP_CYCLE', `milestone dependency cycle detected: ${milestoneCycle.join(', ')}`, '.factory/stages.json'));
  }

  const allStages = milestones.flatMap((m) => m.stages ?? []);
  const stageIds = allStages.map((s) => s.id);
  const seenStages = new Set();
  for (const s of allStages) {
    if (seenStages.has(s.id)) {
      issues.push(issue('STAGE_ID_DUPLICATE', `duplicate stage id "${s.id}"`, '.factory/stages.json'));
    }
    seenStages.add(s.id);
  }
  const stageById = new Map(allStages.map((s) => [s.id, s]));
  for (const m of milestones) {
    for (const s of m.stages ?? []) {
      if (s.milestone !== m.number) {
        issues.push(issue('STAGE_STRUCTURE_INVALID', `stage "${s.id}" milestone M${s.milestone} does not match its parent milestone M${m.number}`, '.factory/stages.json'));
      }
      if (s.n8nResearchGate !== true) {
        issues.push(issue('STAGE_NO_N8N_GATE', `stage "${s.id}" has no n8n research gate`, '.factory/stages.json'));
      }
      if (s.changesUserFacingUi === true && (typeof s.tasteDecision !== 'string' || s.tasteDecision.length === 0)) {
        issues.push(issue('STAGE_NO_TASTE_DECISION', `UI-changing stage "${s.id}" has no Taste decision`, '.factory/stages.json'));
      }
      for (const dep of s.dependsOn ?? []) {
        if (!stageById.has(dep)) {
          issues.push(issue('STAGE_DEP_MISSING', `stage "${s.id}" depends on missing stage "${dep}"`, '.factory/stages.json'));
        }
      }
    }
  }
  const stageCycle = detectCycles(stageIds, (id) => id, (id) => stageById.get(id)?.dependsOn ?? []);
  if (stageCycle.length > 0) {
    issues.push(issue('STAGE_DEP_CYCLE', `stage dependency cycle detected: ${stageCycle.join(', ')}`, '.factory/stages.json'));
  }

  for (const number of [7, 8]) {
    const m = milestoneById.get(number);
    if (!m) {
      issues.push(issue('FUTURE_STARTED_TOO_EARLY', `future milestone ${number} is missing from stages`, '.factory/stages.json'));
    } else if (m.status !== 'future') {
      issues.push(issue('FUTURE_STARTED_TOO_EARLY', `future milestone ${number} must stay status "future"`, '.factory/stages.json'));
    } else if (!(m.stages ?? []).every((s) => s.status === 'future' || s.status === 'blocked')) {
      issues.push(issue('FUTURE_STARTED_TOO_EARLY', `future milestone ${number} has a non-future stage`, '.factory/stages.json'));
    }
  }

  for (const m of milestones) {
    for (const s of m.stages ?? []) {
      const refs = s.acceptanceCriteriaRefs ?? [];
      const seenRefs = new Set();
      const assigned = new Set();
      for (const r of [...reqMap.values()]) {
        if (r.stage === s.id) assigned.add(r.identifier);
      }
      for (const ref of refs) {
        if (!reqMap.has(ref)) {
          issues.push(issue('STAGE_ACC_REF_MISSING', `stage "${s.id}" references missing requirement "${ref}"`, '.factory/stages.json'));
          continue;
        }
        if (seenRefs.has(ref)) {
          issues.push(issue('STAGE_ACC_REQ_DUPLICATE', `stage "${s.id}" duplicates acceptance reference "${ref}"`, '.factory/stages.json'));
        }
        seenRefs.add(ref);
        if (reqMap.get(ref).stage !== s.id) {
          issues.push(issue('STAGE_ACC_REQ_MISASSIGNED', `stage "${s.id}" references requirement "${ref}" assigned to another stage`, '.factory/stages.json'));
        }
      }
      for (const id of assigned) {
        if (!seenRefs.has(id)) {
          issues.push(issue('STAGE_ACC_MISSING_REQUIREMENT', `stage "${s.id}" is missing acceptance reference for assigned requirement "${id}"`, '.factory/stages.json'));
        }
      }
    }
  }

  // Markdown and JSON milestone list agreement.
  const missionText = (!issues.some((i) => i.file === 'docs/backend-factory/01-MASTER-MISSION.md') && pathExists(root, 'docs/backend-factory/01-MASTER-MISSION.md'))
    ? readUtf8(root, 'docs/backend-factory/01-MASTER-MISSION.md')
    : '';
  const roadmapText = (!issues.some((i) => i.file === 'docs/backend-factory/02-BACKEND-ROADMAP.md') && pathExists(root, 'docs/backend-factory/02-BACKEND-ROADMAP.md'))
    ? readUtf8(root, 'docs/backend-factory/02-BACKEND-ROADMAP.md')
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

function validateThreatCatalog(root, threats, reqList, issues) {
  if (!threats) return new Set();
  const seenIds = new Set();
  for (const t of threats.threats) {
    if (seenIds.has(t.id)) {
      issues.push(issue('THREAT_ID_DUPLICATE', `duplicate threat id "${t.id}" in the threat catalog`, '.factory/threats.json'));
    }
    seenIds.add(t.id);
  }
  const ids = new Set(threats.threats.map((t) => t.id));
  const mapped = new Set();
  for (const req of reqList) {
    for (const threat of req.threats ?? []) {
      mapped.add(threat);
    }
  }
  for (const id of ids) {
    if (!mapped.has(id)) {
      issues.push(issue('THREAT_UNREFERENCED', `threat "${id}" is not mapped by any requirement`, '.factory/threats.json'));
    }
  }
  // Markdown threat documentation agreement.
  const docPath = 'docs/backend-factory/08-THREAT-MODEL.md';
  if (pathExists(root, docPath)) {
    const doc = readUtf8(root, docPath);
    const docIds = new Set([...doc.matchAll(/\|\s*(THR-[A-Z0-9-]+)\s*\|/g)].map((m) => m[1]));
    const missing = [...ids].filter((id) => !docIds.has(id));
    const extra = [...docIds].filter((id) => !ids.has(id));
    if (missing.length > 0 || extra.length > 0) {
      issues.push(
        issue('THREAT_DOC_MISMATCH', `08-THREAT-MODEL.md threat list disagrees with catalog (missing ${missing.join(', ') || 'none'}; extra ${extra.join(', ') || 'none'})`, docPath),
      );
    }
  } else {
    issues.push(issue('DOC_MISSING', `required document missing: ${docPath}`, docPath));
  }
  return ids;
}

function validateManifestStaleness(root, manifest, issues) {
  if (!manifest) return;
  const frozen = [...(manifest.frozenFiles ?? [])].sort();
  if (JSON.stringify(frozen) !== JSON.stringify(CANONICAL_FROZEN_FILES)) {
    issues.push(issue('MANIFEST_STALE', 'manifest.frozenFiles does not match the canonical frozen file set', '.factory/manifest.json'));
  }
  for (const file of frozen) {
    if (!pathExists(root, file)) {
      issues.push(issue('MANIFEST_STALE', `manifest lists missing frozen file ${file}`, '.factory/manifest.json'));
      continue;
    }
    const expected = manifest.fileHashes?.[file];
    const actual = sha256(readUtf8(root, file));
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

export function validateFactory(rootDir) {
  const issues = [];

  for (const file of [...REQUIRED_DOCS, ...REQUIRED_EVIDENCE]) {
    if (!pathExists(rootDir, file)) {
      issues.push(issue('DOC_MISSING', `required document missing: ${file}`, file));
    }
  }
  for (const file of [...REQUIRED_MACHINE_FILES, ...REQUIRED_SCHEMAS]) {
    if (!pathExists(rootDir, file)) {
      issues.push(issue('MACHINE_FILE_MISSING', `required machine file missing: ${file}`, file));
    }
  }

  let requirements;
  let stages;
  let state;
  let manifest;
  let threats;
  const jsonFiles = [
    '.factory/requirements.json',
    '.factory/stages.json',
    '.factory/state.json',
    '.factory/manifest.json',
    '.factory/threats.json',
  ];
  for (const file of jsonFiles) {
    try {
      const value = readJson(rootDir, file);
      if (file === '.factory/requirements.json') requirements = value;
      if (file === '.factory/stages.json') stages = value;
      if (file === '.factory/state.json') state = value;
      if (file === '.factory/manifest.json') manifest = value;
      if (file === '.factory/threats.json') threats = value;
    } catch {
      issues.push(issue('INVALID_JSON', `${file} is invalid JSON`, file));
    }
  }

  // Execute the real 2020-12 JSON schemas first.
  validateSchemas(rootDir, issues);

  if (state?.baseCommit !== undefined && state.baseCommit !== REQUIRED_BASE_COMMIT) {
    issues.push(issue('BASE_COMMIT_WRONG', `.factory/state.json baseCommit ${state.baseCommit} does not equal ${REQUIRED_BASE_COMMIT}`, '.factory/state.json'));
  }
  if (manifest?.baseCommit !== undefined && manifest.baseCommit !== REQUIRED_BASE_COMMIT) {
    issues.push(issue('BASE_COMMIT_WRONG', `.factory/manifest.json baseCommit ${manifest.baseCommit} does not equal ${REQUIRED_BASE_COMMIT}`, '.factory/manifest.json'));
  }
  if (manifest && manifest.repository !== 'yousefghorbanian98-create/Coding-Studio') {
    issues.push(issue('MANIFEST_MISMATCH', `.factory/manifest.json repository does not match the expected repository`, '.factory/manifest.json'));
  }

  const reqList = requirements?.requirements;
  if (requirements && (!Array.isArray(reqList) || reqList.length === 0)) {
    issues.push(...checkArrayNonEmpty(reqList, 'MILESTONE_MISSING', '.factory/requirements.json requirements must be a non-empty array', '.factory/requirements.json'));
  }

  const reqMap = new Map((reqList ?? []).map((r) => [r.identifier, r]));
  const allStages = (stages?.milestones ?? []).flatMap((m) => m.stages ?? []);
  const stageMap = new Map(allStages.map((s) => [s.id, s]));
  const threatIds = validateThreatCatalog(rootDir, threats, reqList ?? [], issues);

  if (reqList) {
    validateRequirementGraph(rootDir, reqList, reqMap, stageMap, threatIds, issues);
    for (let milestone = 1; milestone <= 6; milestone += 1) {
      if (!reqList.some((r) => r.milestone === milestone)) {
        issues.push(issue('MILESTONE_MISSING', `no requirement for backend milestone ${milestone}`, '.factory/requirements.json'));
      }
    }
  }

  if (stages && Array.isArray(stages.milestones) && stages.milestones.length > 0) {
    validateStagesGraph(rootDir, stages, stageMap, reqMap, issues);
    for (let milestone = 1; milestone <= 6; milestone += 1) {
      if (!stages.milestones.some((m) => m.number === milestone)) {
        issues.push(issue('MILESTONE_MISSING', `backend milestone ${milestone} is missing`, '.factory/stages.json'));
      }
    }
  } else if (stages) {
    issues.push(issue('MILESTONE_MISSING', '.factory/stages.json milestones must be a non-empty array', '.factory/stages.json'));
  }

  validateManifestStaleness(rootDir, manifest, issues);

  return { ok: issues.length === 0, issues };
}

/**
 * Return the authoritative rule-code inventory. This list is kept in sync with
 * KNOWN_RULE_CODES and is covered by the validator mutation meta-test.
 */
export function validatorRuleCodes() {
  return [...RULE_CODES];
}
