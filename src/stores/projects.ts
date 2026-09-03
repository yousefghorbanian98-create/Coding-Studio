import { create } from 'zustand';
import {
  FIXTURE_RECENT_PROJECTS,
  type RecentProject,
} from '@/services/runtime/fixtures';

const STORAGE_KEY = 'coding-studio:recent-projects';

interface Overrides {
  pinned: Record<string, boolean>;
  removed: string[];
}

function load(): Overrides {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (raw === null || raw === undefined) return { pinned: {}, removed: [] };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { pinned: {}, removed: [] };
    }
    const { pinned, removed } = parsed as Partial<Overrides>;
    return {
      pinned: typeof pinned === 'object' && pinned !== null ? pinned : {},
      removed: Array.isArray(removed) ? removed : [],
    };
  } catch {
    // Corrupt data must not wedge the start page.
    return { pinned: {}, removed: [] };
  }
}

function save(overrides: Overrides): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage being unavailable is not worth breaking the UI over.
  }
}

/** Pinned first, then most recently opened. */
function order(projects: RecentProject[]): RecentProject[] {
  return [...projects].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.lastOpenedAt - a.lastOpenedAt;
  });
}

function build(overrides: Overrides): RecentProject[] {
  const removed = new Set(overrides.removed);
  return order(
    FIXTURE_RECENT_PROJECTS.filter((project) => !removed.has(project.id)).map(
      (project) => ({
        ...project,
        pinned: overrides.pinned[project.id] ?? project.pinned,
      }),
    ),
  );
}

export interface ProjectsState {
  projects: RecentProject[];
  togglePin: (id: string) => void;
  remove: (id: string) => void;
  /** Restores the fixture list; used by tests and the Scenario Lab. */
  reset: () => void;
  /** Empties the list, for the empty-project scenario. */
  clear: () => void;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: build(load()),

  togglePin: (id) => {
    const overrides = load();
    const current =
      overrides.pinned[id] ??
      FIXTURE_RECENT_PROJECTS.find((project) => project.id === id)?.pinned ??
      false;
    const next: Overrides = {
      ...overrides,
      pinned: { ...overrides.pinned, [id]: !current },
    };
    save(next);
    set({ projects: build(next) });
  },

  remove: (id) => {
    const overrides = load();
    const next: Overrides = {
      ...overrides,
      removed: [...new Set([...overrides.removed, id])],
    };
    save(next);
    set({ projects: build(next) });
  },

  reset: () => {
    const empty: Overrides = { pinned: {}, removed: [] };
    save(empty);
    set({ projects: build(empty) });
  },

  clear: () => {
    const next: Overrides = {
      pinned: {},
      removed: FIXTURE_RECENT_PROJECTS.map((project) => project.id),
    };
    save(next);
    set({ projects: build(next) });
  },
}));
