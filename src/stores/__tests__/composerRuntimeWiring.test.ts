import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from '@/stores/chat';
import { connectRunStore, useRunStore } from '@/stores/run';
import { applyScenario } from '@/components/devtools/useScenario';
import { resetRuntime, type ScenarioId } from '@/services/runtime';

/**
 * Sending a message must drive the runtime bridge, not only the text
 * transport. Without this the agent surfaces (plan, tool timeline, approval
 * card) stay empty no matter which scenario is selected — a regression that
 * only shows up end-to-end, so it is pinned here.
 */

let disconnect: (() => void) | null = null;

beforeEach(() => {
  resetRuntime();
  useRunStore.getState().reset();
  useChatStore.setState({ isStreaming: false });
  disconnect = connectRunStore();
});

afterEach(() => {
  disconnect?.();
  disconnect = null;
});

/**
 * Sends one prompt under a scenario and waits until the expected surface
 * appears. Polling a condition rather than sleeping a fixed 800ms keeps this
 * reliable on a slow or loaded CI machine.
 */
async function runUnder(
  scenario: ScenarioId,
  ready: () => boolean,
  timeoutMs = 10_000,
): Promise<void> {
  applyScenario(scenario);
  await useChatStore.getState().sendMessage('go');
  const started = Date.now();
  while (!ready()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`scenario ${scenario} did not produce its surface`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('composer to runtime wiring', () => {
  it('surfaces the plan for a plan scenario', async () => {
    await runUnder('plan-awaiting-approval', () => useRunStore.getState().plan !== null);
    expect(useRunStore.getState().plan).not.toBeNull();
  }, 15_000);

  it('surfaces tool calls for a tool scenario', async () => {
    await runUnder('running-tests', () => useRunStore.getState().toolCalls.length > 0);
    expect(useRunStore.getState().toolCalls.length).toBeGreaterThan(0);
  }, 15_000);

  it('surfaces an approval request for an approval scenario', async () => {
    await runUnder('shell-approval', () => useRunStore.getState().approvals.length > 0);
    expect(useRunStore.getState().approvals.length).toBeGreaterThan(0);
  }, 15_000);

  it('reports file changes for a multi-file scenario', async () => {
    await runUnder('multi-file-changes', () => useRunStore.getState().changes.length > 0);
    expect(useRunStore.getState().changes.length).toBeGreaterThan(0);
  }, 15_000);

  it('leaves the run store idle before anything is sent', () => {
    expect(useRunStore.getState().plan).toBeNull();
    expect(useRunStore.getState().toolCalls).toEqual([]);
    expect(useRunStore.getState().phase).toBe('idle');
  });
});
