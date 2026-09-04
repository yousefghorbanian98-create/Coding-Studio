import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  CANONICAL_FROZEN_FILES,
  REQUIRED_BASE_COMMIT,
  RULE_CODES,
  VALIDATOR_VERSION,
  validateFactory,
} from './validator.mjs';

const REPO_ROOT = process.cwd();
const DIRS: string[] = [];
const TEST_FIXTURE_DIR = REPO_ROOT;

const RESERVED_DOCS = [
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

const REQUIRED_SCHEMA_FILES = [
  '.factory/schemas/requirements.schema.json',
  '.factory/schemas/stages.schema.json',
  '.factory/schemas/state.schema.json',
  '.factory/schemas/manifest.schema.json',
  '.factory/schemas/threats.schema.json',
];

const coveredCodes = new Set<string>();

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

function readRepo(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), 'utf8');
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function baseRequirement(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    identifier: 'FACTORY-001',
    title: 'Fixture requirement',
    description: 'Fixture requirement',
    kind: 'factory',
    milestone: 0,
    stage: 'stage-zero-materialize',
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
      baseRequirement({ identifier: 'FACTORY-002', stage: 'stage-zero-validate' }),
      baseRequirement({ identifier: 'FACTORY-003', stage: 'stage-zero-freeze' }),
      baseRequirement({ identifier: 'JCODE-001', milestone: 1, stage: 'm1-jcode-compat', kind: 'implementation', securitySensitive: true, threats: ['THR-SUPPLY-CHAIN'] }),
      baseRequirement({ identifier: 'INSTALL-001', milestone: 2, stage: 'm2-install-supervisor', kind: 'implementation' }),
      baseRequirement({ identifier: 'IPC-001', milestone: 3, stage: 'm3-tauri-ipc', kind: 'implementation' }),
      baseRequirement({ identifier: 'EVENT-001', milestone: 4, stage: 'm4-events-lifecycle', kind: 'implementation' }),
      baseRequirement({ identifier: 'PROVIDER-001', milestone: 5, stage: 'm5-provider-onboarding', kind: 'implementation' }),
      baseRequirement({ identifier: 'RUFLO-001', milestone: 6, stage: 'm6-ruflo-orchestration', kind: 'implementation' }),
      baseRequirement({ identifier: 'SOUP-001', milestone: 7, stage: 'm7-soup-routing', kind: 'future' }),
      baseRequirement({ identifier: 'OMNIROUTE-001', milestone: 8, stage: 'm8-omni-route', kind: 'future' }),
    ],
  };
}

function requirementsList(): Array<Record<string, any>> {
  return (requirementsPayload() as any).requirements as Array<Record<string, any>>;
}

function reqsForStage(stage: string): string[] {
  return requirementsList()
    .filter((r) => r.stage === stage)
    .map((r) => r.identifier)
    .sort();
}

function stage(id: string, milestone: number, status: string, dependsOn: string[], ui: boolean, taste: string): Record<string, unknown> {
  return {
    id,
    name: id,
    milestone,
    status,
    dependsOn,
    n8nResearchGate: true,
    changesUserFacingUi: ui,
    tasteDecision: ui ? taste || 'Fixture taste decision.' : 'Fixture: no UI change.',
    gates: ['fixture-gate'],
    acceptanceCriteriaRefs: reqsForStage(id),
    evidencePaths: [],
  };
}

function stagesPayload(): unknown {
  const milestones = [
    {
      number: 0,
      title: 'Backend Factory Stage Zero',
      name: 'Stage Zero',
      status: 'active',
      stage: 'stage-zero-freeze',
      requires: [],
      stages: [
        stage('stage-zero-materialize', 0, 'active', [], false, ''),
        stage('stage-zero-validate', 0, 'active', ['stage-zero-materialize'], false, ''),
        stage('stage-zero-freeze', 0, 'active', ['stage-zero-validate'], false, ''),
      ],
    },
    {
      number: 1,
      title: 'Jcode compatibility',
      name: 'Milestone One',
      status: 'planned',
      stage: 'm1-jcode-compat',
      requires: [0],
      stages: [stage('m1-jcode-compat', 1, 'planned', ['stage-zero-freeze'], false, '')],
    },
    {
      number: 2,
      title: 'Managed install and supervisor',
      name: 'Milestone Two',
      status: 'planned',
      stage: 'm2-install-supervisor',
      requires: [1],
      stages: [stage('m2-install-supervisor', 2, 'planned', ['m1-jcode-compat'], false, '')],
    },
    {
      number: 3,
      title: 'Tauri IPC',
      name: 'Milestone Three',
      status: 'planned',
      stage: 'm3-tauri-ipc',
      requires: [2],
      stages: [stage('m3-tauri-ipc', 3, 'planned', ['m2-install-supervisor'], true, 'Fixture timing taste decision.')],
    },
    {
      number: 4,
      title: 'Events and lifecycle',
      name: 'Milestone Four',
      status: 'planned',
      stage: 'm4-events-lifecycle',
      requires: [3],
      stages: [stage('m4-events-lifecycle', 4, 'planned', ['m3-tauri-ipc'], false, '')],
    },
    {
      number: 5,
      title: 'Provider onboarding',
      name: 'Milestone Five',
      status: 'planned',
      stage: 'm5-provider-onboarding',
      requires: [4],
      stages: [stage('m5-provider-onboarding', 5, 'planned', ['m4-events-lifecycle'], true, 'Fixture provider taste decision.')],
    },
    {
      number: 6,
      title: 'Ruflo orchestration',
      name: 'Milestone Six',
      status: 'planned',
      stage: 'm6-ruflo-orchestration',
      requires: [5],
      stages: [stage('m6-ruflo-orchestration', 6, 'planned', ['m5-provider-onboarding'], false, '')],
    },
    {
      number: 7,
      title: 'Soup skill routing',
      name: 'Future Milestone Seven',
      status: 'future',
      stage: 'm7-soup-routing',
      requires: [6],
      stages: [stage('m7-soup-routing', 7, 'future', ['m6-ruflo-orchestration'], true, 'Fixture future taste decision.')],
    },
    {
      number: 8,
      title: 'OmniRoute provider routing',
      name: 'Future Milestone Eight',
      status: 'future',
      stage: 'm8-omni-route',
      requires: [6],
      stages: [stage('m8-omni-route', 8, 'future', ['m6-ruflo-orchestration'], true, 'Fixture future taste decision.')],
    },
  ];
  return { schemaVersion: '1.0.0', milestones };
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
    semantics: {
      lastCommit: 'Semantics placeholder.',
      lastCIrun: 'Semantics placeholder.',
    },
    completedStages: [],
    pendingStages: ['m1-jcode-compat', 'm2-install-supervisor', 'm3-tauri-ipc', 'm4-events-lifecycle', 'm5-provider-onboarding', 'm6-ruflo-orchestration'],
    blockedStages: ['m7-soup-routing', 'm8-omni-route'],
    blockers: [],
  };
}

function threatsPayload(): unknown {
  return {
    schemaVersion: '1.0.0',
    threats: [
      {
        id: 'THR-SUPPLY-CHAIN',
        title: 'Supply chain compromise',
        description: 'Downloaded runtime is not the verified official artifact.',
        controls: 'Official repo verification, pinned versions, checksum verification.',
      },
    ],
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
  return `# Roadmap\n\n| # | Name | Key |\n| --- | --- | --- |\n${entries.map(([num, label, key]) => `| ${num} | ${label} | ${key} |`).join('\n')}\n`;
}

function threatDoc(): string {
  const threats = (threatsPayload() as any).threats as Array<Record<string, string>>;
  return `# Threat Model\n\n## Register\n\n| ID | Title | Description | Primary controls |\n| --- | --- | --- | --- |\n${threats.map((t) => `| ${t.id} | ${t.title} | ${t.description} | ${t.controls} |`).join('\n')}\n`;
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
  write(root, 'docs/backend-factory/08-THREAT-MODEL.md', threatDoc());
  writeJson(root, '.factory/requirements.json', requirementsPayload());
  writeJson(root, '.factory/stages.json', stagesPayload());
  writeJson(root, '.factory/state.json', statePayload());
  writeJson(root, '.factory/threats.json', threatsPayload());
  write(root, '.factory/journal.jsonl', '{}\n');
  for (const file of REQUIRED_SCHEMA_FILES) {
    write(root, file, readRepo(file));
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

afterEach(() => {
  for (const dir of DIRS.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function freshFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), 'factory-fixture-'));
  DIRS.push(dir);
  writeValidFixture(dir);
  expect(validateFactory(dir).ok).toBe(true);
  return dir;
}

function expectFailure(dir: string, code: string, messageFragment?: string): Array<{ code: string; message: string; file?: string }> {
  const result = validateFactory(dir);
  expect(result.ok).toBe(false);
  const found = result.issues.filter((i) => i.code === code);
  expect(found.length).toBeGreaterThan(0);
  coveredCodes.add(code);
  if (messageFragment) {
    expect(found.some((i) => i.message.includes(messageFragment))).toBe(true);
  }
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

  it('fails DOC_MISSING when a required document is missing', () => {
    const dir = freshFixture();
    rmSync(join(dir, 'docs/backend-factory/00-USER-DIRECTIVE.md'));
    expectFailure(dir, 'DOC_MISSING', '00-USER-DIRECTIVE.md');
    restoreAndPass(dir);
  });

  it('fails MACHINE_FILE_MISSING when a required machine file is missing', () => {
    const dir = freshFixture();
    rmSync(join(dir, '.factory/state.json'));
    expectFailure(dir, 'MACHINE_FILE_MISSING', '.factory/state.json');
    restoreAndPass(dir);
  });

  it('fails INVALID_JSON when a machine file is invalid JSON', () => {
    const dir = freshFixture();
    write(dir, '.factory/requirements.json', '{ not json\n');
    expectFailure(dir, 'INVALID_JSON', 'requirements.json');
    restoreAndPass(dir);
  });

  it('fails REQ_SCHEMA_INVALID on a requirements schema violation', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[0].title = '';
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_SCHEMA_INVALID', '/requirements/0/title');
    restoreAndPass(dir);
  });

  it('fails STAGES_SCHEMA_INVALID on a stages schema violation', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[0].number = 'bad';
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGES_SCHEMA_INVALID', '/milestones/0/number');
    restoreAndPass(dir);
  });

  it('fails STATE_SCHEMA_INVALID on a state schema violation', () => {
    const dir = freshFixture();
    const state = clone(statePayload()) as any;
    state.status = 'mystery-status';
    writeJson(dir, '.factory/state.json', state);
    expectFailure(dir, 'STATE_SCHEMA_INVALID', '/status');
    restoreAndPass(dir);
  });

  it('fails MANIFEST_SCHEMA_INVALID on a manifest schema violation', () => {
    const dir = freshFixture();
    const manifest = JSON.parse(readFileSync(join(dir, '.factory/manifest.json'), 'utf8')) as any;
    manifest.reviewStatus = 'bogus';
    writeJson(dir, '.factory/manifest.json', manifest);
    expectFailure(dir, 'MANIFEST_SCHEMA_INVALID', '/reviewStatus');
    restoreAndPass(dir);
  });

  it('fails THREAT_SCHEMA_INVALID on a threats schema violation', () => {
    const dir = freshFixture();
    const threats = clone(threatsPayload()) as any;
    threats.threats[0].id = 'BAD';
    writeJson(dir, '.factory/threats.json', threats);
    expectFailure(dir, 'THREAT_SCHEMA_INVALID', '/threats/0/id');
    restoreAndPass(dir);
  });

  it('fails MANIFEST_MISMATCH when the manifest repository differs', () => {
    const dir = freshFixture();
    const manifest = JSON.parse(readFileSync(join(dir, '.factory/manifest.json'), 'utf8')) as any;
    manifest.repository = 'wrong/repo';
    writeJson(dir, '.factory/manifest.json', manifest);
    expectFailure(dir, 'MANIFEST_MISMATCH', 'repository');
    restoreAndPass(dir);
  });

  it('fails MILESTONE_MISSING when a backend milestone is missing', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones = stages.milestones.filter((m: { number: number }) => m.number !== 6);
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'MILESTONE_MISSING', 'milestone 6');
    restoreAndPass(dir);
  });

  it('fails MILESTONE_DUPLICATE when milestone numbers duplicate', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    const extra = clone(stages.milestones[0]) as any;
    extra.stage = 'stage-zero-dupe';
    extra.stages = [{ ...extra.stages[0], id: 'stage-zero-dupe', milestone: 0, acceptanceCriteriaRefs: [] }];
    stages.milestones.push(extra);
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'MILESTONE_DUPLICATE', 'duplicate milestone number 0');
    restoreAndPass(dir);
  });

  it('fails MILESTONE_DEP_MISSING when a milestone depends on a missing milestone', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[1].requires = [99];
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'MILESTONE_DEP_MISSING', 'missing milestone 99');
    restoreAndPass(dir);
  });

  it('fails MILESTONE_DEP_CYCLE on a milestone dependency cycle', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[0].requires = [1];
    stages.milestones[1].requires = [0];
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'MILESTONE_DEP_CYCLE', 'milestone dependency cycle');
    restoreAndPass(dir);
  });

  it('fails STAGE_ID_DUPLICATE when stage ids duplicate', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[2].stages[0].id = 'm1-jcode-compat';
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_ID_DUPLICATE', 'duplicate stage id');
    restoreAndPass(dir);
  });

  it('fails STAGE_DEP_MISSING when a stage depends on a missing stage', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[1].stages[0].dependsOn = ['missing-stage'];
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_DEP_MISSING', 'missing stage "missing-stage"');
    restoreAndPass(dir);
  });

  it('fails STAGE_DEP_CYCLE on a stage dependency cycle', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[1].stages[0].dependsOn = ['m2-install-supervisor'];
    stages.milestones[2].stages[0].dependsOn = ['m1-jcode-compat'];
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_DEP_CYCLE', 'stage dependency cycle');
    restoreAndPass(dir);
  });

  it('fails STAGE_STRUCTURE_INVALID when a stage milestone mismatches its parent', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[2].stages[0].milestone = 3;
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_STRUCTURE_INVALID', 'does not match its parent milestone');
    restoreAndPass(dir);
  });

  it('fails STAGE_NO_N8N_GATE when a stage has no n8n research gate', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[0].stages[0].n8nResearchGate = false;
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_NO_N8N_GATE', 'n8n research gate');
    restoreAndPass(dir);
  });

  it('fails STAGE_NO_TASTE_DECISION on an UI-changing stage without a Taste decision', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[3].stages[0].changesUserFacingUi = true;
    stages.milestones[3].stages[0].tasteDecision = '';
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_NO_TASTE_DECISION', 'Taste decision');
    restoreAndPass(dir);
  });

  it('fails FUTURE_STARTED_TOO_EARLY when a future milestone starts early', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[7].status = 'active';
    stages.milestones[7].stages[0].status = 'active';
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'FUTURE_STARTED_TOO_EARLY', 'future milestone 7');
    restoreAndPass(dir);
  });

  it('fails REQ_ID_DUPLICATED when a requirement identifier duplicates', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[1] = { ...requirements.requirements[1], identifier: 'FACTORY-001', stage: 'stage-zero-materialize' };
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_ID_DUPLICATED', 'duplicate requirement identifier');
    restoreAndPass(dir);
  });

  it('fails REQ_NO_MILESTONE when a requirement has no milestone', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    delete requirements.requirements[0].milestone;
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_NO_MILESTONE', 'has no milestone');
    restoreAndPass(dir);
  });

  it('fails REQ_NO_STAGE when a requirement has no stage', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    delete requirements.requirements[0].stage;
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_NO_STAGE', 'has no stage');
    restoreAndPass(dir);
  });

  it('fails REQ_STAGE_MISSING when a requirement references a missing stage', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[0].stage = 'missing-stage';
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_STAGE_MISSING', 'missing stage "missing-stage"');
    restoreAndPass(dir);
  });

  it('fails REQ_STAGE_MILESTONE_MISMATCH when a requirement disagrees with the stage milestone', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[0].milestone = 2;
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_STAGE_MILESTONE_MISMATCH', 'does not match stage');
    restoreAndPass(dir);
  });

  it('fails REQ_DEP_MISSING when a requirement depends on a missing requirement', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[0].dependencies = ['NO-SUCH'];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_DEP_MISSING', 'NO-SUCH');
    restoreAndPass(dir);
  });

  it('fails REQ_DEP_CYCLE on a requirement dependency cycle', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[0].dependencies = ['JCODE-001'];
    requirements.requirements[3].dependencies = ['FACTORY-001'];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_DEP_CYCLE', 'requirement dependency cycle');
    restoreAndPass(dir);
  });

  it('fails REQ_NO_ACCEPTANCE when a requirement has no acceptance criterion', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[0].acceptanceCriteria = [];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_NO_ACCEPTANCE', 'acceptance criterion');
    restoreAndPass(dir);
  });

  it('fails REQ_NO_PLANNED_TEST when a requirement has no planned test', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[0].plannedUnitTests = [];
    requirements.requirements[0].plannedIntegrationTests = [];
    requirements.requirements[0].plannedWindowsTests = [];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'REQ_NO_PLANNED_TEST', 'planned test');
    restoreAndPass(dir);
  });

  it('fails SECURITY_REQ_NO_THREAT when a security-sensitive requirement has no threat', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[3].securitySensitive = true;
    requirements.requirements[3].threats = [];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'SECURITY_REQ_NO_THREAT', 'no threat mapping');
    restoreAndPass(dir);
  });

  it('fails THREAT_MISSING when a requirement references an unknown threat', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[3].threats = ['THR-UNKNOWN'];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'THREAT_MISSING', 'THR-UNKNOWN');
    restoreAndPass(dir);
  });

  it('fails THREAT_UNREFERENCED when a catalog threat is unmapped', () => {
    const dir = freshFixture();
    const threats = clone(threatsPayload()) as any;
    threats.threats.push({ id: 'THR-EXTRA', title: 'Extra', description: 'Extra', controls: 'Extra' });
    writeJson(dir, '.factory/threats.json', threats);
    expectFailure(dir, 'THREAT_UNREFERENCED', 'THR-EXTRA');
    restoreAndPass(dir);
  });

  it('fails THREAT_DOC_MISMATCH when the threat markdown disagrees with the catalog', () => {
    const dir = freshFixture();
    write(dir, 'docs/backend-factory/08-THREAT-MODEL.md', '# Threat Model\n\n| ID | Title | Description | Primary controls |\n| --- | --- | --- | --- |\n| THR-OTHER | x | y | z |\n');
    expectFailure(dir, 'THREAT_DOC_MISMATCH', 'THR-SUPPLY-CHAIN');
    restoreAndPass(dir);
  });

  it('fails STAGE_ACC_REF_MISSING when a stage references a missing requirement', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[0].stages[2].acceptanceCriteriaRefs.push('NO-SUCH');
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_ACC_REF_MISSING', 'NO-SUCH');
    restoreAndPass(dir);
  });

  it('fails STAGE_ACC_REQ_MISASSIGNED when a stage references a requirement assigned elsewhere', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[0].stages[2].acceptanceCriteriaRefs.push('FACTORY-001');
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_ACC_REQ_MISASSIGNED', 'assigned to another stage');
    restoreAndPass(dir);
  });

  it('fails STAGE_ACC_REQ_DUPLICATE when a stage duplicates an acceptance reference', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[0].stages[2].acceptanceCriteriaRefs.push('FACTORY-003');
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_ACC_REQ_DUPLICATE', 'duplicates acceptance reference');
    restoreAndPass(dir);
  });

  it('fails STAGE_ACC_MISSING_REQUIREMENT when a stage omits an assigned requirement', () => {
    const dir = freshFixture();
    const stages = clone(stagesPayload()) as any;
    stages.milestones[0].stages[0].acceptanceCriteriaRefs = [];
    writeJson(dir, '.factory/stages.json', stages);
    expectFailure(dir, 'STAGE_ACC_MISSING_REQUIREMENT', 'assigned requirement');
    restoreAndPass(dir);
  });

  it('fails COMPLETE_NO_EVIDENCE when a completed requirement has no evidence', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[0].status = 'complete';
    requirements.requirements[0].evidencePaths = [];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'COMPLETE_NO_EVIDENCE', 'no evidence');
    restoreAndPass(dir);
  });

  it('fails COMPLETE_EVIDENCE_PATH_MISSING when a completed requirement evidence path does not exist', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[0].status = 'complete';
    requirements.requirements[0].evidencePaths = ['missing-evidence'];
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'COMPLETE_EVIDENCE_PATH_MISSING', 'missing-evidence');
    restoreAndPass(dir);
  });

  it('fails COMPLETE_IMPL_NO_COMMIT when a completed implementation lacks a commit', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[3].status = 'complete';
    requirements.requirements[3].evidencePaths = ['docs/backend-factory/00-USER-DIRECTIVE.md'];
    requirements.requirements[3].implementationCommit = null;
    requirements.requirements[3].ciRun = '123';
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'COMPLETE_IMPL_NO_COMMIT', 'no commit');
    restoreAndPass(dir);
  });

  it('fails COMPLETE_IMPL_NO_CI when a completed implementation lacks a CI run', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[3].status = 'complete';
    requirements.requirements[3].evidencePaths = ['docs/backend-factory/00-USER-DIRECTIVE.md'];
    requirements.requirements[3].implementationCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    requirements.requirements[3].ciRun = null;
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'COMPLETE_IMPL_NO_CI', 'no CI run');
    restoreAndPass(dir);
  });

  it('fails IMPL_COMMIT_INVALID when a completed implementation commit is malformed', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[3].status = 'complete';
    requirements.requirements[3].evidencePaths = ['docs/backend-factory/00-USER-DIRECTIVE.md'];
    requirements.requirements[3].implementationCommit = 'abc';
    requirements.requirements[3].ciRun = '123';
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'IMPL_COMMIT_INVALID', 'not a 40 hex commit');
    restoreAndPass(dir);
  });

  it('fails CI_RUN_INVALID when a completed implementation CI run is malformed', () => {
    const dir = freshFixture();
    const requirements = clone(requirementsPayload()) as any;
    requirements.requirements[3].status = 'complete';
    requirements.requirements[3].evidencePaths = ['docs/backend-factory/00-USER-DIRECTIVE.md'];
    requirements.requirements[3].implementationCommit = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    requirements.requirements[3].ciRun = 'garbage';
    writeJson(dir, '.factory/requirements.json', requirements);
    expectFailure(dir, 'CI_RUN_INVALID', 'not a valid run id');
    restoreAndPass(dir);
  });

  it('fails MARKDOWN_JSON_MILESTONE_MISMATCH when markdown misses a milestone', () => {
    const dir = freshFixture();
    write(dir, 'docs/backend-factory/01-MASTER-MISSION.md', missionText().replace('MILESTONE SIX', 'SIXTH MILESTONE'));
    expectFailure(dir, 'MARKDOWN_JSON_MILESTONE_MISMATCH', 'MILESTONE SIX');
    restoreAndPass(dir);
  });

  it('fails MANIFEST_STALE when a frozen document is altered without a manifest update', () => {
    const dir = freshFixture();
    write(dir, 'docs/backend-factory/01-MASTER-MISSION.md', missionText() + 'tampered\n');
    expectFailure(dir, 'MANIFEST_STALE', 'manifest hash mismatch');
    restoreAndPass(dir);
  });

  it('fails BASE_COMMIT_WRONG when the required base commit is wrong', () => {
    const dir = freshFixture();
    const state = clone(statePayload()) as any;
    state.baseCommit = '0000000000000000000000000000000000000000';
    writeJson(dir, '.factory/state.json', state);
    expectFailure(dir, 'BASE_COMMIT_WRONG', 'does not equal');
    restoreAndPass(dir);
  });

  it('asserts meaningful path and message detail for schema errors', () => {
    const dir = freshFixture();
    const threats = clone(threatsPayload()) as any;
    threats.threats[0].id = 'BAD';
    writeJson(dir, '.factory/threats.json', threats);
    const issues = expectFailure(dir, 'THREAT_SCHEMA_INVALID', '/threats/0/id');
    expect(issues.some((i) => i.file === '.factory/threats.json')).toBe(true);
    restoreAndPass(dir);
  });

  it('covers the full authoritative rule-code inventory with mutation tests', () => {
    expect(RULE_CODES.length).toBe(new Set(RULE_CODES).size);
    expect([...coveredCodes].sort()).toEqual([...RULE_CODES].sort());
  });

  it('works against the actual repository', () => {
    const result = validateFactory(TEST_FIXTURE_DIR);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
