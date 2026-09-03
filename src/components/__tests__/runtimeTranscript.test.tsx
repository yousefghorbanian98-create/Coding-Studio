import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { AppShell } from '@/components/shell/AppShell';
import { resetRuntime } from '@/services/runtime';

/**
 * A-1 end-to-end guard.
 *
 * Drives the real default MockStudioRuntime through the real shell and asserts
 * the reply on screen is the runtime's own text. Before the fix the transcript
 * showed canned prose from the removed legacy transport instead, so this
 * fails if a second message-generation path is ever reintroduced.
 */
afterEach(() => {
  resetRuntime();
});

describe('the rendered transcript comes from the runtime', () => {
  it('shows the runtime reply after sending a prompt', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppShell />);

    await user.type(screen.getByTestId('composer-input'), 'Hello runtime');
    await user.click(screen.getByTestId('send-button'));

    await waitFor(
      () => {
        const messages = screen.getAllByTestId('message-assistant');
        const last = messages[messages.length - 1]?.textContent ?? '';
        // This sentence exists only in MockStudioRuntime's NORMAL_REPLY.
        expect(last).toMatch(/I reviewed the workspace/);
      },
      { timeout: 5000 },
    );
  }, 15_000);
});
