import { beforeEach, describe, expect, it } from 'vitest';
import {
  PERMISSION_KINDS,
  defaultPermissions,
  isHighRisk,
  loadPermissions,
  usePermissions,
} from '../permissions';

const STORAGE_KEY = 'coding-studio:permissions';

beforeEach(() => {
  localStorage.clear();
  usePermissions.setState({ policies: defaultPermissions() });
});

describe('defaults', () => {
  it('starts every action on ask so nothing runs unattended', () => {
    const policies = defaultPermissions();
    for (const kind of PERMISSION_KINDS) {
      expect(policies[kind]).toBe('ask');
    }
  });

  it('marks the destructive actions as high risk', () => {
    expect(isHighRisk('shell-command')).toBe(true);
    expect(isHighRisk('delete')).toBe(true);
    expect(isHighRisk('network-access')).toBe(true);
    expect(isHighRisk('file-modification')).toBe(false);
  });

  it('reports no relaxed policy on a fresh install', () => {
    expect(usePermissions.getState().hasRelaxedPolicy()).toBe(false);
  });
});

describe('changing a policy', () => {
  it('stores the new value and persists it', () => {
    usePermissions.getState().setPolicy('shell-command', 'allow');
    expect(usePermissions.getState().policies['shell-command']).toBe('allow');
    expect(localStorage.getItem(STORAGE_KEY)).toContain('allow');
  });

  it('flags a relaxed policy only for allow, not for never', () => {
    usePermissions.getState().setPolicy('delete', 'never');
    expect(usePermissions.getState().hasRelaxedPolicy()).toBe(false);
    usePermissions.getState().setPolicy('delete', 'allow');
    expect(usePermissions.getState().hasRelaxedPolicy()).toBe(true);
  });

  it('restores every action to ask on reset', () => {
    usePermissions.getState().setPolicy('shell-command', 'allow');
    usePermissions.getState().setPolicy('delete', 'never');
    usePermissions.getState().resetPermissions();
    for (const kind of PERMISSION_KINDS) {
      expect(usePermissions.getState().policies[kind]).toBe('ask');
    }
  });
});

describe('loading stored policies', () => {
  it('round-trips a saved map', () => {
    usePermissions.getState().setPolicy('git-operation', 'never');
    expect(loadPermissions()['git-operation']).toBe('never');
  });

  it('falls back to ask for unknown values rather than trusting them', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ 'shell-command': 'yolo', delete: 'allow' }),
    );
    const loaded = loadPermissions();
    expect(loaded['shell-command']).toBe('ask');
    expect(loaded['delete']).toBe('allow');
  });

  it('survives corrupt JSON with safe defaults', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    expect(loadPermissions()).toEqual(defaultPermissions());
  });

  it('ignores a non-object payload', () => {
    localStorage.setItem(STORAGE_KEY, '"a string"');
    expect(loadPermissions()).toEqual(defaultPermissions());
  });

  it('fills in actions missing from an older stored map', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ delete: 'never' }));
    const loaded = loadPermissions();
    expect(loaded['delete']).toBe('never');
    expect(loaded['network-access']).toBe('ask');
  });
});
