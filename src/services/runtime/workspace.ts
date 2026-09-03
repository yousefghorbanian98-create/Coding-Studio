/**
 * Deterministic workspace fixtures.
 *
 * These describe the file tree, search results, diffs and panel output the UI
 * renders. No real file system access happens in this build: the Jcode runtime
 * will supply the same shapes over IPC later.
 */

export interface FileNode {
  path: string;
  name: string;
  kind: 'file' | 'directory';
  /** Git-style status, when the file differs from HEAD. */
  status?: 'added' | 'modified' | 'deleted' | 'renamed';
  children?: FileNode[];
}

export const FIXTURE_TREE: FileNode = {
  path: '',
  name: 'coding-studio',
  kind: 'directory',
  children: [
    {
      path: 'src',
      name: 'src',
      kind: 'directory',
      children: [
        {
          path: 'src/components',
          name: 'components',
          kind: 'directory',
          children: [
            {
              path: 'src/components/AppShell.tsx',
              name: 'AppShell.tsx',
              kind: 'file',
              status: 'modified',
            },
            {
              path: 'src/components/Composer.tsx',
              name: 'Composer.tsx',
              kind: 'file',
            },
          ],
        },
        {
          path: 'src/services',
          name: 'services',
          kind: 'directory',
          children: [
            {
              path: 'src/services/runtime.ts',
              name: 'runtime.ts',
              kind: 'file',
              status: 'added',
            },
            {
              path: 'src/services/legacy.ts',
              name: 'legacy.ts',
              kind: 'file',
              status: 'deleted',
            },
          ],
        },
        { path: 'src/main.tsx', name: 'main.tsx', kind: 'file' },
      ],
    },
    {
      path: 'docs',
      name: 'docs',
      kind: 'directory',
      children: [
        { path: 'docs/README.md', name: 'README.md', kind: 'file' },
        {
          path: 'docs/architecture.md',
          name: 'architecture.md',
          kind: 'file',
          status: 'modified',
        },
      ],
    },
    { path: 'package.json', name: 'package.json', kind: 'file' },
  ],
};

export interface SearchMatch {
  line: number;
  column: number;
  /** Full source line, used for the preview. */
  text: string;
  /** Length of the matched span starting at `column`. */
  length: number;
}

export interface SearchFileResult {
  path: string;
  matches: SearchMatch[];
}

/**
 * Filters the fixture corpus for a query.
 *
 * Case-insensitive substring matching keeps the behaviour predictable and lets
 * the UI highlight the exact span without a regex engine.
 */
const SEARCH_CORPUS: { path: string; lines: string[] }[] = [
  {
    path: 'src/components/AppShell.tsx',
    lines: [
      'export function AppShell(): React.ReactElement {',
      '  const refresh = useRuntimeStore((s) => s.refresh);',
      '  useEffect(() => connectRunStore(), []);',
      '  return <div className="app-shell">{children}</div>;',
    ],
  },
  {
    path: 'src/services/runtime.ts',
    lines: [
      'export interface StudioRuntimeBridge {',
      '  getHealth(): Promise<RuntimeHealth>;',
      '  cancelRun(runId: RunId): Promise<void>;',
      '}',
    ],
  },
  {
    path: 'docs/architecture.md',
    lines: [
      '# Frontend architecture',
      'The runtime bridge is the only seam the UI depends on.',
      'Events are validated before they reach any component.',
    ],
  },
];

export function searchWorkspace(query: string): SearchFileResult[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const results: SearchFileResult[] = [];
  for (const file of SEARCH_CORPUS) {
    const matches: SearchMatch[] = [];
    file.lines.forEach((text, index) => {
      const column = text.toLowerCase().indexOf(needle);
      if (column !== -1) {
        matches.push({
          line: index + 1,
          column,
          text,
          length: needle.length,
        });
      }
    });
    if (matches.length > 0) results.push({ path: file.path, matches });
  }
  return results;
}

export type DiffLineKind = 'context' | 'added' | 'removed';

export interface DiffLine {
  kind: DiffLineKind;
  oldLine: number | null;
  newLine: number | null;
  text: string;
}

export interface FileDiff {
  path: string;
  previousPath?: string;
  kind: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  binary?: boolean;
  lines: DiffLine[];
}

export const FIXTURE_DIFFS: readonly FileDiff[] = [
  {
    path: 'src/services/runtime.ts',
    kind: 'added',
    additions: 5,
    deletions: 0,
    lines: [
      { kind: 'added', oldLine: null, newLine: 1, text: 'export interface StudioRuntimeBridge {' },
      { kind: 'added', oldLine: null, newLine: 2, text: '  getHealth(): Promise<RuntimeHealth>;' },
      { kind: 'added', oldLine: null, newLine: 3, text: '  cancelRun(runId: RunId): Promise<void>;' },
      { kind: 'added', oldLine: null, newLine: 4, text: '}' },
      { kind: 'added', oldLine: null, newLine: 5, text: '' },
    ],
  },
  {
    path: 'src/components/AppShell.tsx',
    kind: 'modified',
    additions: 2,
    deletions: 2,
    lines: [
      { kind: 'context', oldLine: 10, newLine: 10, text: 'export function AppShell() {' },
      { kind: 'removed', oldLine: 11, newLine: null, text: '  const models = useOldStore();' },
      { kind: 'removed', oldLine: 12, newLine: null, text: '  connectLegacy();' },
      { kind: 'added', oldLine: null, newLine: 11, text: '  const refresh = useRuntimeStore((s) => s.refresh);' },
      { kind: 'added', oldLine: null, newLine: 12, text: '  useEffect(() => connectRunStore(), []);' },
      { kind: 'context', oldLine: 13, newLine: 13, text: '  return <Shell />;' },
    ],
  },
  {
    path: 'src/services/legacy.ts',
    kind: 'deleted',
    additions: 0,
    deletions: 2,
    lines: [
      { kind: 'removed', oldLine: 1, newLine: null, text: 'export const LEGACY = true;' },
      { kind: 'removed', oldLine: 2, newLine: null, text: 'export function connectLegacy() {}' },
    ],
  },
  {
    path: 'assets/logo.png',
    kind: 'modified',
    additions: 0,
    deletions: 0,
    binary: true,
    lines: [],
  },
];

export type ProblemSeverity = 'error' | 'warning' | 'info';

export interface Problem {
  id: string;
  severity: ProblemSeverity;
  path: string;
  line: number;
  column: number;
  message: string;
  source: string;
}

export const FIXTURE_PROBLEMS: readonly Problem[] = [
  {
    id: 'prob-1',
    severity: 'error',
    path: 'src/components/AppShell.tsx',
    line: 11,
    column: 9,
    message: "Cannot find name 'useOldStore'.",
    source: 'ts(2304)',
  },
  {
    id: 'prob-2',
    severity: 'warning',
    path: 'src/services/runtime.ts',
    line: 3,
    column: 3,
    message: 'Method is defined but never used in this file.',
    source: 'eslint',
  },
  {
    id: 'prob-3',
    severity: 'info',
    path: 'docs/architecture.md',
    line: 2,
    column: 1,
    message: 'Consider linking the runtime contract directly.',
    source: 'markdownlint',
  },
];

export type OutputLevel = 'debug' | 'info' | 'warn' | 'error';

export interface OutputLine {
  id: string;
  channel: string;
  level: OutputLevel;
  /** Fixed offset in ms from the session start, so screenshots stay stable. */
  offsetMs: number;
  text: string;
}

export const OUTPUT_CHANNELS = ['Runtime', 'Build', 'Tests'] as const;

export const FIXTURE_OUTPUT: readonly OutputLine[] = [
  { id: 'o1', channel: 'Runtime', level: 'info', offsetMs: 0, text: 'Mock runtime started (mock-1.0.0).' },
  { id: 'o2', channel: 'Runtime', level: 'debug', offsetMs: 120, text: 'Event schema version 1.0.0.' },
  { id: 'o3', channel: 'Build', level: 'info', offsetMs: 340, text: 'Vite build completed in 5.7s.' },
  { id: 'o4', channel: 'Build', level: 'warn', offsetMs: 350, text: 'Chunk larger than 500 kB after minification.' },
  { id: 'o5', channel: 'Tests', level: 'info', offsetMs: 900, text: '228 tests passed.' },
  { id: 'o6', channel: 'Runtime', level: 'error', offsetMs: 1200, text: 'Dropped 1 malformed event (message.delta).' },
];

export interface TerminalEntry {
  id: string;
  command: string;
  output: string;
  status: 'running' | 'success' | 'failure';
  exitCode?: number;
}

export const FIXTURE_TERMINAL: readonly TerminalEntry[] = [
  {
    id: 'term-1',
    command: 'npm run typecheck',
    output: 'tsc -b && tsc -p tsconfig.e2e.json\nNo errors found.',
    status: 'success',
    exitCode: 0,
  },
  {
    id: 'term-2',
    command: 'npm test -- --run',
    output: 'Test Files  21 passed (21)\n     Tests  228 passed (228)',
    status: 'success',
    exitCode: 0,
  },
];

/** Canned responses so the demo terminal behaves predictably. */
export function respondToCommand(command: string): {
  output: string;
  status: 'success' | 'failure';
  exitCode: number;
} {
  const trimmed = command.trim();
  if (trimmed === 'help') {
    return {
      output:
        'Demo terminal. Available: help, npm test, npm run build, echo <text>.',
      status: 'success',
      exitCode: 0,
    };
  }
  if (trimmed.startsWith('echo ')) {
    return { output: trimmed.slice(5), status: 'success', exitCode: 0 };
  }
  if (trimmed === 'npm test') {
    return { output: '228 tests passed.', status: 'success', exitCode: 0 };
  }
  if (trimmed === 'npm run build') {
    return { output: 'Build completed in 5.7s.', status: 'success', exitCode: 0 };
  }
  return {
    output: `Command not available in the demo terminal: ${trimmed}`,
    status: 'failure',
    exitCode: 127,
  };
}
