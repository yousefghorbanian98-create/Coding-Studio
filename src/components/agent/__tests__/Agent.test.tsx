import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { ApprovalCard } from '../ApprovalCard';
import { PlanCard } from '../PlanCard';
import { ToolTimeline } from '../ToolTimeline';
import { useRunStore } from '@/stores/run';
import {
  asApprovalId,
  asPlanId,
  asRunId,
  asSessionId,
  asTaskId,
  asToolCallId,
  type ApprovalRequest,
  type RuntimePlan,
  type ToolCall,
} from '@/services/runtime';

const RUN = asRunId('run-1');
const SESSION = asSessionId('sess-1');

const plan: RuntimePlan = {
  id: asPlanId('plan-1'),
  runId: RUN,
  sessionId: SESSION,
  title: 'Proposed approach',
  status: 'awaiting-approval',
  steps: [
    {
      id: asTaskId('task-1'),
      title: 'Read the modules',
      detail: 'Inspect the seams',
      status: 'completed',
    },
    {
      id: asTaskId('task-2'),
      title: 'Apply the refactor',
      detail: 'Introduce the bridge',
      status: 'running',
    },
  ],
};

const call: ToolCall = {
  id: asToolCallId('tool-1'),
  runId: RUN,
  kind: 'run-tests',
  title: 'npm test',
  status: 'completed',
  output: '141 passed',
  durationMs: 1200,
  startedAt: 1,
};

const approval: ApprovalRequest = {
  id: asApprovalId('appr-1'),
  runId: RUN,
  sessionId: SESSION,
  kind: 'shell-command',
  title: 'Run a shell command',
  detail: 'The agent wants to run the test suite.',
  risk: 'high',
  command: 'npm test -- --run',
  requestedAt: 1,
};

beforeEach(() => {
  useRunStore.getState().reset();
  useRunStore.getState().beginRun(RUN, SESSION);
});

describe('PlanCard', () => {
  it('renders nothing without a plan', () => {
    renderWithProviders(<PlanCard />);
    expect(screen.queryByTestId('plan-card')).not.toBeInTheDocument();
  });

  it('renders the steps and their statuses', () => {
    useRunStore.getState().apply({ type: 'plan.created', plan });
    renderWithProviders(<PlanCard />);

    expect(screen.getByTestId('plan-card')).toHaveAttribute(
      'data-status',
      'awaiting-approval',
    );
    expect(screen.getByTestId('plan-step-task-1')).toHaveAttribute(
      'data-status',
      'completed',
    );
    expect(screen.getByText('Apply the refactor')).toBeInTheDocument();
  });
});

describe('ToolTimeline', () => {
  it('renders nothing when no tool ran', () => {
    renderWithProviders(<ToolTimeline />);
    expect(screen.queryByTestId('tool-timeline')).not.toBeInTheDocument();
  });

  it('shows a card with status and duration', () => {
    useRunStore.getState().apply({ type: 'tool.completed', call });
    renderWithProviders(<ToolTimeline />);

    expect(screen.getByTestId('tool-card-tool-1')).toHaveAttribute(
      'data-status',
      'completed',
    );
    expect(screen.getByText('1.2 s')).toBeInTheDocument();
  });

  it('expands and collapses the details', async () => {
    const user = userEvent.setup();
    useRunStore.getState().apply({ type: 'tool.completed', call });
    renderWithProviders(<ToolTimeline />);

    const toggle = screen.getByTestId('tool-toggle-tool-1');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(screen.getByTestId('tool-detail-tool-1')).toHaveTextContent(
      '141 passed',
    );

    await user.click(toggle);
    expect(screen.queryByTestId('tool-detail-tool-1')).not.toBeInTheDocument();
  });
});

describe('ApprovalCard', () => {
  beforeEach(() => {
    useRunStore.getState().apply({ type: 'approval.requested', approval });
  });

  it('focuses the safest action when it appears', async () => {
    renderWithProviders(<ApprovalCard />);
    await waitFor(() => {
      expect(screen.getByTestId('approval-reject')).toHaveFocus();
    });
  });

  it('marks a high-risk request distinctly', () => {
    renderWithProviders(<ApprovalCard />);
    expect(screen.getByTestId('approval-card')).toHaveAttribute(
      'data-risk',
      'high',
    );
  });

  it('sends an approve-once decision', async () => {
    const user = userEvent.setup();
    const resolve = vi.fn(() => Promise.resolve());
    useRunStore.setState({ resolveApproval: resolve });
    renderWithProviders(<ApprovalCard />);

    await user.click(screen.getByTestId('approval-approve-once'));
    expect(resolve).toHaveBeenCalledWith(approval.id, {
      decision: 'approve-once',
    });
  });

  it('sends a rejection', async () => {
    const user = userEvent.setup();
    const resolve = vi.fn(() => Promise.resolve());
    useRunStore.setState({ resolveApproval: resolve });
    renderWithProviders(<ApprovalCard />);

    await user.click(screen.getByTestId('approval-reject'));
    expect(resolve).toHaveBeenCalledWith(approval.id, { decision: 'reject' });
  });

  it('passes the edited command when the user changes it', async () => {
    const user = userEvent.setup();
    const resolve = vi.fn(() => Promise.resolve());
    useRunStore.setState({ resolveApproval: resolve });
    renderWithProviders(<ApprovalCard />);

    const input = screen.getByTestId('approval-command');
    await user.clear(input);
    await user.type(input, 'npm test -- --run --bail');
    expect(screen.getByTestId('approval-edited')).toBeInTheDocument();

    await user.click(screen.getByTestId('approval-approve-once'));
    expect(resolve).toHaveBeenCalledWith(approval.id, {
      decision: 'approve-once',
      editedCommand: 'npm test -- --run --bail',
    });
  });

  it('declines when Escape is pressed', async () => {
    const user = userEvent.setup();
    const resolve = vi.fn(() => Promise.resolve());
    useRunStore.setState({ resolveApproval: resolve });
    renderWithProviders(<ApprovalCard />);

    await user.keyboard('{Escape}');
    expect(resolve).toHaveBeenCalledWith(approval.id, { decision: 'reject' });
  });

  it('cannot be resolved twice by double clicking', async () => {
    const user = userEvent.setup();
    const resolve = vi.fn(() => Promise.resolve());
    useRunStore.setState({ resolveApproval: resolve });
    renderWithProviders(<ApprovalCard />);

    const button = screen.getByTestId('approval-approve-once');
    await user.dblClick(button);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('is reachable by keyboard alone', async () => {
    const user = userEvent.setup();
    const resolve = vi.fn(() => Promise.resolve());
    useRunStore.setState({ resolveApproval: resolve });
    renderWithProviders(<ApprovalCard />);

    await waitFor(() => {
      expect(screen.getByTestId('approval-reject')).toHaveFocus();
    });
    await user.tab();
    expect(screen.getByTestId('approval-approve-once')).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(resolve).toHaveBeenCalledWith(approval.id, {
      decision: 'approve-once',
    });
  });
});
