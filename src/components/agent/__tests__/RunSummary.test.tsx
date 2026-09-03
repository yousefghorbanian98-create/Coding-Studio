import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { RunSummary } from '../RunSummary';
import { useRunStore } from '@/stores/run';

beforeEach(() => {
  useRunStore.getState().reset();
});

describe('RunSummary', () => {
  it('renders nothing before a run finishes', () => {
    useRunStore.setState({ phase: 'streaming', summary: 'Not ready yet.' });
    renderWithProviders(<RunSummary />);
    expect(screen.queryByTestId('run-summary')).toBeNull();
  });

  it('renders nothing when a completed run carries no summary', () => {
    useRunStore.setState({ phase: 'completed', summary: null });
    renderWithProviders(<RunSummary />);
    expect(screen.queryByTestId('run-summary')).toBeNull();
  });

  it('shows the summary once the run completes', () => {
    useRunStore.setState({
      phase: 'completed',
      summary: 'Updated 3 files and ran the test suite.',
    });
    renderWithProviders(<RunSummary />);
    expect(screen.getByTestId('run-summary')).toHaveTextContent(
      'Updated 3 files and ran the test suite.',
    );
  });

  it('hides the summary again when a later run is cancelled', () => {
    useRunStore.setState({ phase: 'cancelled', summary: 'Stale text.' });
    renderWithProviders(<RunSummary />);
    expect(screen.queryByTestId('run-summary')).toBeNull();
  });
});

/**
 * Regression: RunSummary was covered only in isolation, so removing
 * `<RunSummary />` from ChatArea kept all 595 tests green while the summary
 * vanished from the product. This asserts it is actually mounted in the
 * transcript.
 */
describe('RunSummary is wired into the chat transcript', () => {
  it('appears inside ChatArea once a run completes', async () => {
    const { ChatArea } = await import('@/components/chat/ChatArea');
    useRunStore.setState({
      phase: 'completed',
      summary: 'Updated 3 files and ran the test suite.',
    });
    renderWithProviders(<ChatArea />);

    expect(screen.getByTestId('run-summary')).toHaveTextContent(
      'Updated 3 files and ran the test suite.',
    );
  });
});
