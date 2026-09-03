import { create } from 'zustand';
import type { ApprovalKind } from '@/services/runtime';

/**
 * How the agent should treat a class of action.
 *
 * `ask` is the safe default everywhere: nothing runs unattended until the user
 * opts in, and `never` is an explicit block rather than a silent skip.
 */
export type PermissionPolicy = 'ask' | 'allow' | 'never';

export const PERMISSION_KINDS: readonly ApprovalKind[] = [
  'file-modification',
  'shell-command',
  'package-install',
  'network-access',
  'git-operation',
  'delete',
  'external-path',
];

/** Actions that stay on `ask` unless deliberately changed. */
const HIGH_RISK: readonly ApprovalKind[] = [
  'shell-command',
  'package-install',
  'network-access',
  'delete',
  'external-path',
];

export type PermissionMap = Record<ApprovalKind, PermissionPolicy>;

export function defaultPermissions(): PermissionMap {
  return PERMISSION_KINDS.reduce<PermissionMap>((map, kind) => {
    map[kind] = 'ask';
    return map;
  }, {} as PermissionMap);
}

export function isHighRisk(kind: ApprovalKind): boolean {
  return HIGH_RISK.includes(kind);
}

const STORAGE_KEY = 'coding-studio:permissions';

/** Reads stored policies, ignoring anything unrecognised. */
export function loadPermissions(
  storage: Storage | undefined = globalThis.localStorage,
): PermissionMap {
  const base = defaultPermissions();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return base;
  }
  if (raw === null) return base;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return base;
    for (const kind of PERMISSION_KINDS) {
      const value = (parsed as Record<string, unknown>)[kind];
      if (value === 'ask' || value === 'allow' || value === 'never') {
        base[kind] = value;
      }
    }
    return base;
  } catch {
    return base;
  }
}

function savePermissions(map: PermissionMap): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Persistence is best-effort; the in-memory policy still applies.
  }
}

export interface PermissionsState {
  policies: PermissionMap;
  setPolicy: (kind: ApprovalKind, policy: PermissionPolicy) => void;
  resetPermissions: () => void;
  /** True when anything has been loosened away from the safe default. */
  hasRelaxedPolicy: () => boolean;
}

export const usePermissions = create<PermissionsState>()((set, get) => ({
  policies: loadPermissions(),

  setPolicy: (kind, policy) => {
    const policies = { ...get().policies, [kind]: policy };
    set({ policies });
    savePermissions(policies);
  },

  resetPermissions: () => {
    const policies = defaultPermissions();
    set({ policies });
    savePermissions(policies);
  },

  hasRelaxedPolicy: () =>
    PERMISSION_KINDS.some((kind) => get().policies[kind] === 'allow'),
}));
