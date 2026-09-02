import { describe, expect, it } from 'vitest';
import {
  FIXTURE_DIFFS,
  FIXTURE_OUTPUT,
  FIXTURE_PROBLEMS,
  FIXTURE_TREE,
  OUTPUT_CHANNELS,
  respondToCommand,
  searchWorkspace,
  type FileNode,
} from '../workspace';

function walk(node: FileNode, visit: (node: FileNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

describe('searchWorkspace', () => {
  it('returns nothing for an empty or whitespace query', () => {
    expect(searchWorkspace('')).toEqual([]);
    expect(searchWorkspace('   ')).toEqual([]);
  });

  it('matches case-insensitively', () => {
    const lower = searchWorkspace('runtime');
    const upper = searchWorkspace('RUNTIME');
    expect(lower).toEqual(upper);
    expect(lower.length).toBeGreaterThan(0);
  });

  it('reports the exact matched span so the UI can highlight it', () => {
    const [file] = searchWorkspace('StudioRuntimeBridge');
    expect(file).toBeDefined();
    const match = file?.matches[0];
    expect(match).toBeDefined();
    if (!file || !match) return;
    expect(
      match.text.slice(match.column, match.column + match.length).toLowerCase(),
    ).toBe('studioruntimebridge');
    expect(match.line).toBeGreaterThan(0);
  });

  it('returns an empty list when nothing matches', () => {
    expect(searchWorkspace('zzz-not-present-zzz')).toEqual([]);
  });

  it('never returns a file entry without matches', () => {
    for (const file of searchWorkspace('e')) {
      expect(file.matches.length).toBeGreaterThan(0);
    }
  });
});

describe('workspace fixtures', () => {
  it('gives every tree node a unique path', () => {
    const paths: string[] = [];
    walk(FIXTURE_TREE, (node) => paths.push(node.path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('only lets directories carry children', () => {
    walk(FIXTURE_TREE, (node) => {
      if (node.kind === 'file') expect(node.children).toBeUndefined();
    });
  });

  it('covers added, modified, deleted and binary diffs', () => {
    const kinds = FIXTURE_DIFFS.map((diff) => diff.kind);
    expect(kinds).toContain('added');
    expect(kinds).toContain('modified');
    expect(kinds).toContain('deleted');
    expect(FIXTURE_DIFFS.some((diff) => diff.binary === true)).toBe(true);
  });

  it('keeps diff counters consistent with the line list', () => {
    for (const diff of FIXTURE_DIFFS) {
      if (diff.binary === true) continue;
      const additions = diff.lines.filter((l) => l.kind === 'added').length;
      const deletions = diff.lines.filter((l) => l.kind === 'removed').length;
      expect(additions).toBe(diff.additions);
      expect(deletions).toBe(diff.deletions);
    }
  });

  it('numbers diff lines on the correct side', () => {
    for (const diff of FIXTURE_DIFFS) {
      for (const line of diff.lines) {
        if (line.kind === 'added') expect(line.oldLine).toBeNull();
        if (line.kind === 'removed') expect(line.newLine).toBeNull();
        if (line.kind === 'context') {
          expect(line.oldLine).not.toBeNull();
          expect(line.newLine).not.toBeNull();
        }
      }
    }
  });

  it('exposes at least one problem of every severity', () => {
    const severities = new Set(FIXTURE_PROBLEMS.map((p) => p.severity));
    expect(severities).toEqual(new Set(['error', 'warning', 'info']));
  });

  it('only emits output lines on declared channels', () => {
    for (const line of FIXTURE_OUTPUT) {
      expect(OUTPUT_CHANNELS).toContain(line.channel);
    }
  });
});

describe('respondToCommand', () => {
  it('describes the available demo commands', () => {
    const result = respondToCommand('help');
    expect(result.status).toBe('success');
    expect(result.output).toContain('help');
  });

  it('echoes text back', () => {
    expect(respondToCommand('echo hello world').output).toBe('hello world');
  });

  it('ignores surrounding whitespace', () => {
    expect(respondToCommand('  npm test  ').status).toBe('success');
  });

  it('fails clearly for unsupported commands instead of pretending', () => {
    const result = respondToCommand('rm -rf /');
    expect(result.status).toBe('failure');
    expect(result.exitCode).toBe(127);
    expect(result.output).toContain('rm -rf /');
  });
});
