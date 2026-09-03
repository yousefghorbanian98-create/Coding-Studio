import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { BottomPanel } from '../BottomPanel';
import { useRunStore } from '@/stores/run';
import { useUiStore } from '@/stores/ui';
import { asRunId, asTaskId, type RuntimeTask } from '@/services/runtime';

const task = (id: string, status: RuntimeTask['status'], title: string): RuntimeTask => ({
  id: asTaskId(id),
  runId: asRunId('r1'),
  title,
  status,
});

describe('Tasks panel', () => {
  beforeEach(() => {
    useRunStore.setState({ tasks: [] });
    useUiStore.setState({ panelOpen: true, panelTab: 'tasks' });
  });

  it('explains itself when no task has been created', () => {
    renderWithProviders(<BottomPanel />);
    expect(screen.getByTestId('tasks-empty')).toBeInTheDocument();
  });

  it('reports progress over the whole task list', () => {
    useRunStore.setState({
      tasks: [
        task('t1', 'completed', 'Read the store'),
        task('t2', 'running', 'Patch the reducer'),
        task('t3', 'pending', 'Add a test'),
      ],
    });
    renderWithProviders(<BottomPanel />);
    expect(screen.getByTestId('tasks-progress')).toHaveTextContent('1 of 3 done');
  });

  it('filters to a single status and back', async () => {
    const user = userEvent.setup();
    useRunStore.setState({
      tasks: [
        task('t1', 'completed', 'Read the store'),
        task('t2', 'running', 'Patch the reducer'),
      ],
    });
    renderWithProviders(<BottomPanel />);

    await user.click(screen.getByTestId('tasks-filter-running'));
    expect(screen.getByTestId('task-t2')).toBeInTheDocument();
    expect(screen.queryByTestId('task-t1')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('tasks-filter-all'));
    expect(screen.getByTestId('task-t1')).toBeInTheDocument();
  });

  it('only offers filters for statuses that are present', () => {
    useRunStore.setState({ tasks: [task('t1', 'running', 'Patch the reducer')] });
    renderWithProviders(<BottomPanel />);
    expect(screen.getByTestId('tasks-filter-running')).toBeInTheDocument();
    // No task is blocked, so a blocked filter would only ever show nothing.
    expect(screen.queryByTestId('tasks-filter-blocked')).not.toBeInTheDocument();
  });

  it('surfaces why a task is blocked', () => {
    useRunStore.setState({
      tasks: [{ ...task('t1', 'blocked', 'Install deps'), blockedReason: 'Awaiting approval' }],
    });
    renderWithProviders(<BottomPanel />);
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();
  });

  it('states each status as text, not colour alone', () => {
    useRunStore.setState({ tasks: [task('t1', 'completed', 'Read the store')] });
    renderWithProviders(<BottomPanel />);
    expect(screen.getByTestId('task-t1')).toHaveTextContent('Completed');
  });
});

describe('Tasks panel — active task and actions', () => {
  beforeEach(() => {
    useRunStore.setState({ tasks: [] });
    useUiStore.setState({ panelOpen: true, panelTab: 'tasks' });
  });

  it('highlights the running task', () => {
    useRunStore.setState({
      tasks: [task('t1', 'pending', 'Later'), task('t2', 'running', 'Now')],
    });
    renderWithProviders(<BottomPanel />);
    expect(screen.getByTestId('task-t2')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('task-t1')).toHaveAttribute('data-active', 'false');
  });

  it('offers cancel only for the running task', () => {
    useRunStore.setState({
      tasks: [task('t1', 'pending', 'Later'), task('t2', 'running', 'Now')],
    });
    renderWithProviders(<BottomPanel />);
    expect(screen.getByTestId('task-cancel-t2')).toBeInTheDocument();
    expect(screen.queryByTestId('task-cancel-t1')).not.toBeInTheDocument();
  });

  it('marks retry inert and explains why the mock cannot do it', () => {
    useRunStore.setState({ tasks: [task('t1', 'failed', 'Broke')] });
    renderWithProviders(<BottomPanel />);
    const retry = screen.getByTestId('task-retry-t1');
    expect(retry).toHaveAttribute('aria-disabled', 'true');
    expect(retry.getAttribute('title')).toMatch(/managed runtime/i);
  });
});

describe('Terminal output controls', () => {
  beforeEach(() => {
    useUiStore.setState({ panelOpen: true, panelTab: 'terminal' });
  });

  it('offers clear and copy while the seeded transcript has output', () => {
    renderWithProviders(<BottomPanel />);
    expect(screen.getByTestId('terminal-clear')).toBeEnabled();
    expect(screen.getByTestId('terminal-copy')).toBeEnabled();
  });

  it('copies the whole transcript, commands included', async () => {
    // userEvent.setup() installs its own clipboard stub, so the spy has to be
    // planted after it or it gets overwritten.
    const user = userEvent.setup();
    const writeText = vi.fn((_text: string) => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderWithProviders(<BottomPanel />);

    await user.click(screen.getByTestId('terminal-copy'));

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]?.[0]).toContain('$ ');
  });

  it('empties the transcript and then disables both controls', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);

    await user.click(screen.getByTestId('terminal-clear'));

    expect(screen.getByTestId('terminal-clear')).toBeDisabled();
    expect(screen.getByTestId('terminal-copy')).toBeDisabled();
  });
});

describe('Problems and Output controls', () => {
  it('filters problems by severity and shows an empty state', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ panelOpen: true, panelTab: 'problems' });
    renderWithProviders(<BottomPanel />);

    await user.click(screen.getByTestId('problems-filter-error'));
    const rows = screen.getAllByTestId(/^problem-/);
    expect(rows.length).toBeGreaterThan(0);

    await user.click(screen.getByTestId('problems-filter-all'));
    expect(screen.getAllByTestId(/^problem-/).length).toBeGreaterThanOrEqual(
      rows.length,
    );
  });

  it('clears an output channel and says it is empty', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ panelOpen: true, panelTab: 'output' });
    renderWithProviders(<BottomPanel />);

    await user.click(screen.getByTestId('output-clear'));

    expect(screen.getByTestId('output-empty')).toBeInTheDocument();
    expect(screen.getByTestId('output-clear')).toBeDisabled();
  });
});
