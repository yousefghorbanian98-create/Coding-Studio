import type { ModelDescriptor, ProviderDescriptor } from './types';

/**
 * Provider-neutral catalogue used by the mock runtime.
 *
 * These describe the providers the product will support once the Jcode runtime
 * is integrated. Nothing here performs authentication or network access: the
 * descriptors exist so the selection UX can be built and tested honestly.
 */

export const FIXTURE_PROVIDERS: readonly ProviderDescriptor[] = [
  {
    id: 'demo',
    name: 'Demo Runtime',
    vendor: 'Coding Studio',
    authState: 'demo',
    disabled: false,
  },
  {
    id: 'anthropic',
    name: 'Claude',
    vendor: 'Anthropic',
    authState: 'not-configured',
    disabled: true,
    disabledReasonKey: 'providers.needsRuntime',
  },
  {
    id: 'openai',
    name: 'OpenAI / Codex',
    vendor: 'OpenAI',
    authState: 'not-configured',
    disabled: true,
    disabledReasonKey: 'providers.needsRuntime',
  },
  {
    id: 'google',
    name: 'Gemini',
    vendor: 'Google',
    authState: 'not-configured',
    disabled: true,
    disabledReasonKey: 'providers.needsRuntime',
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    vendor: 'GitHub',
    authState: 'not-configured',
    disabled: true,
    disabledReasonKey: 'providers.needsRuntime',
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-compatible',
    vendor: 'Self-hosted',
    authState: 'not-configured',
    disabled: true,
    disabledReasonKey: 'providers.needsRuntime',
  },
];

export const FIXTURE_MODELS: readonly ModelDescriptor[] = [
  {
    id: 'demo-balanced',
    providerId: 'demo',
    name: 'Demo Balanced',
    contextK: 128,
    description: 'Deterministic mock model used for UI development.',
    badge: 'balanced',
  },
  {
    id: 'demo-fast',
    providerId: 'demo',
    name: 'Demo Fast',
    contextK: 64,
    description: 'Shorter replies with minimal latency.',
    badge: 'fast',
  },
  {
    id: 'demo-reasoning',
    providerId: 'demo',
    name: 'Demo Reasoning',
    contextK: 200,
    description: 'Produces plans and multi-step task breakdowns.',
    badge: 'reasoning',
  },
];

export const DEFAULT_PROVIDER_ID = 'demo';
export const DEFAULT_MODEL_ID = 'demo-balanced';

export interface RecentProject {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: number;
  branch: string;
  pinned: boolean;
  /** Mock availability state, so the UI can show honest failures. */
  state: 'available' | 'missing' | 'permission-denied';
}

/** Fixed timestamps keep the "last opened" column stable in screenshots. */
const DAY = 86_400_000;
const BASE_TIME = Date.UTC(2026, 0, 15, 9, 0, 0);

export const FIXTURE_RECENT_PROJECTS: readonly RecentProject[] = [
  {
    id: 'proj-studio',
    name: 'coding-studio',
    path: 'C:\\dev\\coding-studio',
    lastOpenedAt: BASE_TIME,
    branch: 'main',
    pinned: true,
    state: 'available',
  },
  {
    id: 'proj-api',
    name: 'billing-api',
    path: 'C:\\dev\\acme\\billing-api',
    lastOpenedAt: BASE_TIME - DAY,
    branch: 'feature/invoices',
    pinned: false,
    state: 'available',
  },
  {
    id: 'proj-site',
    name: 'marketing-site',
    path: 'D:\\work\\marketing-site',
    lastOpenedAt: BASE_TIME - 3 * DAY,
    branch: 'main',
    pinned: false,
    state: 'missing',
  },
  {
    id: 'proj-legacy',
    name: 'legacy-reports',
    path: 'E:\\archive\\legacy-reports',
    lastOpenedAt: BASE_TIME - 9 * DAY,
    branch: 'release/2024',
    pinned: false,
    state: 'permission-denied',
  },
];

/** Looks up a model descriptor by id. */
export function findModel(id: string): ModelDescriptor | undefined {
  return FIXTURE_MODELS.find((model) => model.id === id);
}

/** Looks up a provider descriptor by id. */
export function findProvider(id: string): ProviderDescriptor | undefined {
  return FIXTURE_PROVIDERS.find((provider) => provider.id === id);
}
