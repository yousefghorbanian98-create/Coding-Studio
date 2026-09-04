import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  CANONICAL_FROZEN_FILES,
  REQUIRED_BASE_COMMIT,
  VALIDATOR_VERSION,
  validateFactory,
} from './validator.mjs';

const REQUIRED_DOCS = [
  '00-USER-DIRECTIVE.md',
  '01-MASTER-MISSION.md',
  '02-BACKEND-ROADMAP.md',
  '03-ARCHITECTURE.md',
  '04-REQUIREMENTS.md',
  '05-ACCEPTANCE-MATRIX.md',
  '06-TRACEABILITY-MATRIX.md',
  '07-STATE-MACHINE.md',
  '08-THREAT-MODEL.md',
  '09-TEST-STRATEGY.md',
  '10-N8N-RESEARCH-POLICY.md',
  '11-OSS-ADOPTION-POLICY.md',
  '12-SELF-HEAL-RUNBOOK.md',
  '13-RECOVERY-RUNBOOK.md',
  '14-PROVIDER-PLAN.md',
  '15-RUFLO-PLAN.md',
];

const RESERVED_DOCS = REQUIRED_DOCS;
const SCHEMA_FILES = [
  '.factory/schemas/requirements.schema.json',
  '.factory/schemas/stages.schema.json',
  '.factory/schemas/state.schema.json',
  '.factory/schemas/manifest.schema.json',
];

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function write(root: string, relative: string, content: string): void {
  const target = join(root, relative);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

function writeJson(root: string, relative: string, value: unknown): void {
  write(root, relative, `${JSON.stringify(value, null, 2)}\n`);
}

function baseRequirement(overrides: Record<string, unknown> = {}) {
  return {
    identifier: 'FACTORY-001',
    title: 'Fixture requirement',
    description: 'Fixture requirement',
    kind: 'factory',
    milestone: 0,
    stage: 'stage-zero-freeze',
    status: 'planned',
    securitySensitive: false,
    acceptanceCriteria: ['The fixture validates.'],
    nonGoals: [],
    dependencies: [],
    threats: [],
    implementationFiles: [],
    plannedUnitTests: ['Fixture unit test.'],
    plannedIntegrationTests: [],
    plannedWindowsTests: [],
    n8nResearch: 'Fixture n8n research gate.',
    tasteDecision: 'Fixture taste decision.',
    ossProvenance: 'Fixture OSS provenance.',
    evidencePaths: [],
    implementationCommit: null,
    ciRun: null,
    ...overrides,
  };
}

function requirementsPayload(): unknown {
  return {
    schemaVersion: '1.0.0',
    requirements: [
      baseRequirement(),
      baseRequirement({ identifier: 'JCODE-001', milestone: 1, stage: 'm1-jcode-compat' }),
      baseRequirement({ identifier: 'INSTALL-001', milestone: 2, stage: 'm2-install-supervisor' }),
      baseRequirement({ identifier: 'IPC-001', milestone: 3, stage: 'm3-tauri-ipc' }),
      baseRequirement({ identifier: 'EVENT-001', milestone: 4, stage: 'm4-events-lifecycle' }),
      baseRequirement({ identifier: 'PROVIDER-001', milestone: 5, stage: 'm5-provider-onboarding' }),
      baseRequirement({ identifier: 'RUFLO-001', milestone: 6, stage: 'm6-ruflo-orchestration' }),
    ],
  };
}

function milestone(number: number, title: string, name: string, stage: string, requires: number[], status: string, changeUi = false, taste = ''): Record<string, unknown> {
  return {
    number,
    title,
    name,
    status,
    stage,
    requires,
    stages: [
      {
        id: stage,
        name,
        milestone: number,
        status,
        dependsOn: [],
        n8nResearchGate: true,
        changesUserFacingUi: changeUi,
        tasteDecision: changeUi ? taste || 'Fixture taste decision.' : 'Fixture: no UI change.',
        gates: ['fixture-gate'],
        acceptanceCriteriaRefs: [],
        evidencePaths: [],
      },
    ],
  };
}

function stagesPayload(): unknown {
  return {
    schemaVersion: '1.0.0',
    milestones: [
      milestone(0, 'Backend Factory Stage Zero', 'Stage Zero', 'stage-zero-freeze', [], 'active'),
      milestone(1, 'Jcode compatibility and stable machine protocol', 'Milestone One', 'm1-jcode-compat', [], 'planned'),
      milestone(2, 'Managed Jcode installation and Rust process supervisor', 'Milestone Two', 'm2-install-supervisor', [1], 'planned'),
      milestone(3, 'Tauri IPC and StudioRuntimeBridge integration', 'Milestone Three', 'm3-tauri-ipc', [2], 'planned'),
      milestone(4, 'Event normalization, sessions, approvals, cancellation and recovery', 'Milestone Four', 'm4-events-lifecycle', [3], 'planned'),
      milestone(5, 'Provider onboarding through Jcode', 'Milestone Five', 'm5-provider-onboarding', [4], 'planned'),
      milestone(6, 'Ruflo advanced orchestration', 'Milestone Six', 'm6-ruflo-orchestration', [5], 'planned'),
      milestone(7, 'Soup skill routing', 'Future Milestone Seven', 'm7-soup-routing', [6], 'future'),
      milestone(8, 'OmniRoute provider routing', 'Future Milestone Eight', 'm8-omni-route', [6], 'future'),
    ],
  };
}

function statePayload(): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    runIdentifier: 'fixture-run',
    repository: 'yousefghorbanian98-create/Coding-Studio',
    branch: 'arena/01a06b4c-coding-studio',
    baseCommit: REQUIRED_BASE_COMMIT,
    activeMilestone: 0,
    activeStage: 'stage-zero-freeze',
    activeGate: 'freeze',
    status: 'stage-zero',
    attemptCounters: {
      healingAttempts: 0,
      ciRemediationAttempts: 0,
      reviewAndFixRounds: 0,
      noProgressIterations: 0,
      identicalFailureFingerprints: 0,
    },
    lastProgressTime: '2026-09-04T00:00:00.000Z',
    lastCommit: null,
    lastCIrun: null,
    completedStages: [],
    pendingStages: ['stage-zero-freeze'],
    blockedStages: ['m7-soup-routing', 'm8-omni-route'],
    blockers: [],
  };
}

function missionText(): string {
  const heading = (n: number) =>
    n === 7 ? 'FUTURE MILESTONE SEVEN' : n === 8 ? 'FUTURE MILESTONE EIGHT' : `MILESTONE ${['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'][n - 1]}`;
  return [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `## ${heading(n)}`).join('\n');
}

function roadmapText(): string {
  const entries = [
    [0, 'Stage Zero', 'M0'],
    [1, 'Milestone One', 'M1'],
    [2, 'Milestone Two', 'M2'],
    [3, 'Milestone Three', 'M3'],
    [4, 'Milestone Four', 'M4'],
    [5, 'Milestone Five', 'M5'],
    [6, 'Milestone Six', 'M6'],
    [7, 'Future Milestone Seven', 'M7'],
    [8, 'Future Milestone Eight', 'M8'],
  ];
  return entries.map(([, label, num]) => `| ${num} | ${label} |`).join('\n');
}

function writeValidFixture(root: string): void {
  for (const name of RESERVED_DOCS) {
    write(root, `docs/backend-factory/${name}`, `# ${name}\n\nPlaceholder.`);
  }
  for (const file of [
    'docs/backend-factory/evidence/stage-zero/finn-loop-research.md',
    'docs/backend-factory/evidence/stage-zero/n8n-research.md',
    'docs/backend-factory/evidence/stage-zero/taste-decision.md',
    'docs/backend-factory/evidence/stage-zero/oss-register.md',
    'docs/backend-factory/evidence/stage-zero/mission-review.md',
  ]) {
    write(root, file, '# Evidence placeholder\n');
  }
  write(root, 'docs/backend-factory/01-MASTER-MISSION.md', missionText());
  write(root, 'docs/backend-factory/02-BACKEND-ROADMAP.md', roadmapText());
  writeJson(root, '.factory/requirements.json', requirementsPayload());
  writeJson(root, '.factory/stages.json', stagesPayload());
  writeJson(root, '.factory/state.json', statePayload());
  write(root, '.factory/journal.jsonl', '{}\n');
  for (const file of SCHEMA_FILES) {
    writeJson(root, file, {});
  }

  const fileHashes: Record<string, string> = {};
  for (const file of CANONICAL_FROZEN_FILES) {
    fileHashes[file] = sha256(readFileSync(join(root, file), 'utf8'));
  }
  writeJson(root, '.factory/manifest.json', {
    schemaVersion: '1.0.0',
    repository: 'yousefghorbanian98-create/Coding-Studio',
    branch: 'arena/01a06b4c-coding-studio',
    baseCommit: REQUIRED_BASE_COMMIT,
    frozenFiles: CANONICAL_FROZEN_FILES,
    fileHashes,
    generationTime: '2026-09-04T00:00:00.000Z',
    reviewStatus: 'pending',
    validatorVersion: VALIDATOR_VERSION,
  });
}

function writeDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function freshFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'factory-fixture-'));
  dirs.push(dir);
  writeValidFixture(dir);
  expect(validateFactory(dir).ok).toBe(true);
  return dir;
}

function expectFailure(dir: string, code: string) {
  const result = validateFactory(dir);
  expect(result.ok).toBe(false);
  expect(result.issues.some((i: { code: string }) => i.code === code)).toBe(true);
  return result.issues;
}

function restoreAndPass(dir: string) {
  writeValidFixture(dir);
  expect(validateFactory(dir).ok).toBe(true);
}

describe('factory validator', () => {
  it('validates a fresh fixture', () => {
    const dir = freshFixture();
    expect(validateFactory(dir).ok).toBe(true);
  });

  it('fails when a required document is missing', () => {
    const dir = freshFixture();
    rmSync(join(dir, 'docs/backend-factory/00-USER-DIRECTIVE.md'));
    expectFailure(dir, 'DOC_MISSING');
    restoreAndPass(dir);
  });

  it('fails when a required machine file is missing', () => {
    const dir = freshFixture();
    rmSync(join(dir, '.factory/state.json'));
    expectFailure(dir, 'MACHINE_FILE_MISSING');
    restoreAndPass(dir);
  });

  it('fails when a backend milestone is missing', () => {
    const dir = freshFixture();
    const stages = writeDeep(stagesPayload()) as any;
    stages.milestones = stages.milestones.filter((m: { number: number }) => m.number !== 6);
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'MILESTONE_MISSING');
    restoreAndPass(dir);
  });

  it('fails when a requirement identifier is duplicated', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    requirements.requirements[1] = { ...requirements.requirements[1], identifier: 'FACTORY-001' };
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_ID_DUPLICATED');
    restoreAndPass(dir);
  });

  it('fails when a requirement has no milestone', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    delete requirements.requirements[0].milestone;
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_NO_MILESTONE');
    restoreAndPass(dir);
  });

  it('fails when a requirement has no stage', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    delete requirements.requirements[0].stage;
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_NO_STAGE');
    restoreAndPass(dir);
  });

  it('fails when a requirement has no acceptance criterion', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    requirements.requirements[0].acceptanceCriteria = [];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_NO_ACCEPTANCE');
    restoreAndPass(dir);
  });

  it('fails when a requirement has no planned test', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    requirements.requirements[0].plannedUnitTests = [];
    requirements.requirements[0].plannedIntegrationTests = [];
    requirements.requirements[0].plannedWindowsTests = [];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_NO_PLANNED_TEST');
    restoreAndPass(dir);
  });

  it('fails when a security-sensitive requirement has no threat mapping', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    requirements.requirements[0].securitySensitive = true;
    requirements.requirements[0].threats = [];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'SECURITY_REQ_NO_THREAT');
    restoreAndPass(dir);
  });

  it('fails when a stage has no n8n research gate', () => {
    const dir = freshFixture();
    const stages = writeDeep(stagesPayload()) as any;
    stages.milestones[0].stages[0].n8nResearchGate = false;
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_NO_N8N_GATE');
    restoreAndPass(dir);
  });

  it('fails when an UI-changing stage has no Taste decision', () => {
    const dir = freshFixture();
    const stages = writeDeep(stagesPayload()) as any;
    stages.milestones[3].stages[0].changesUserFacingUi = true;
    stages.milestones[3].stages[0].tasteDecision = '';
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_NO_TASTE_DECISION');
    restoreAndPass(dir);
  });

  it('fails when a completed requirement has no evidence', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    requirements.requirements[0].status = 'complete';
    requirements.requirements[0].evidencePaths = [];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'COMPLETE_NO_EVIDENCE');
    restoreAndPass(dir);
  });

  it('fails when a completed implementation has no commit', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    requirements.requirements[1].kind = 'implementation';
    requirements.requirements[1].status = 'complete';
    requirements.requirements[1].evidencePaths = ['evidence'];
    requirements.requirements[1].implementationCommit = null;
    requirements.requirements[1].ciRun = 'ci-run';
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'COMPLETE_IMPL_NO_COMMIT');
    restoreAndPass(dir);
  });

  it('fails when a completed implementation has no CI run', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    requirements.requirements[1].kind = 'implementation';
    requirements.requirements[1].status = 'complete';
    requirements.requirements[1].evidencePaths = ['evidence'];
    requirements.requirements[1].implementationCommit = 'abc';
    requirements.requirements[1].ciRun = null;
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'COMPLETE_IMPL_NO_CI');
    restoreAndPass(dir);
  });

  it('fails when milestone dependencies contain a cycle', () => {
    const dir = freshFixture();
    const stages = writeDeep(stagesPayload()) as any;
    stages.milestones[0].requires = [1];
    stages.milestones[1].requires = [2];
    stages.milestones[2].requires = [0];
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'MILESTONE_DEP_CYCLE');
    restoreAndPass(dir);
  });

  it('fails when stage dependencies contain a cycle', () => {
    const dir = freshFixture();
    const stages = writeDeep(stagesPayload()) as any;
    stages.milestones[1].stages[0].dependsOn = ['m2-install-supervisor'];
    stages.milestones[2].stages[0].dependsOn = ['m1-jcode-compat'];
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_DEP_CYCLE');
    restoreAndPass(dir);
  });

  it('fails when a future milestone starts too early', () => {
    const dir = freshFixture();
    const stages = writeDeep(stagesPayload()) as any;
    stages.milestones[7].status = 'active';
    stages.milestones[7].stages[0].status = 'active';
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'FUTURE_STARTED_TOO_EARLY');
    restoreAndPass(dir);
  });

  it('fails when markdown and JSON milestone lists disagree', () => {
    const dir = freshFixture();
    write(dir, 'docs/backend-factory/01-MASTER-MISSION.md', missionText().replace('MILESTONE SIX', 'SIXTH MILESTONE'));
    expectFailure(dir, 'MARKDOWN_JSON_MILESTONE_MISMATCH');
    restoreAndPass(dir);
  });

  it('fails when the manifest is stale', () => {
    const dir = freshFixture();
    write(dir, 'docs/backend-factory/01-MASTER-MISSION.md', missionText() + 'tampered\n');
    expectFailure(dir, 'MANIFEST_STALE');
    restoreAndPass(dir);
  });

  it('fails when the state schema is invalid', () => {
    const dir = freshFixture();
    const state = writeDeep(statePayload()) as any;
    state.status = 'mystery-status';
    writeJson(dir, '.factory/state.json', state);
    expectFailure(dir, 'STATE_SCHEMA_INVALID');
    restoreAndPass(dir);
  });

  it('fails when the required base commit is wrong', () => {
    const dir = freshFixture();
    const state = writeDeep(statePayload()) as any;
    state.baseCommit = '0000000000000000000000000000000000000000';
    writeJson(dir, '.factory/state.json', state);
    expectFailure(dir, 'BASE_COMMIT_WRONG');
    restoreAndPass(dir);
  });

  it('emits meaningful error codes and messages', () => {
    const dir = freshFixture();
    const requirements = writeDeep(requirementsPayload()) as any;
    requirements.requirements[0].acceptanceCriteria = [];
    writeJson(dir, '.factory/requirements.json', requirements);
    const issues = expectFailure(dir, 'REQ_NO_ACCEPTANCE');
    const found = issues.find((i: { code: string }) => i.code === 'REQ_NO_ACCEPTANCE');
    expect(found?.message).toContain('acceptance criterion');
  });
});
