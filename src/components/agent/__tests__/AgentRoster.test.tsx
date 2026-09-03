import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { AgentRoster } from '../AgentRoster';
import { useRunStore } from '@/stores/run';
import { asAgentId, type AgentState } from '@/services/runtime';

const agent = (over: Partial<AgentState> = {}): AgentState => ({
  id: asAgentId('a1'),
  name: 'Frontend Agent',
  role: 'Implements UI changes',
  status: 'working' as const,
  currentTask: 'Working on step 2',
  completedTasks: 1,
  ...over,
});

describe('AgentRoster', () => {
  beforeEach(() => {
    useRunStore.setState({ agents: [] });
  });

  it('renders nothing when no agent has reported', () => {
    renderWithProviders(<AgentRoster />);
    expect(screen.queryByTestId('agent-roster')).not.toBeInTheDocument();
  });

  it('lists each agent with its name and current task', () => {
    useRunStore.setState({ agents: [agent()] });
    renderWithProviders(<AgentRoster />);
    expect(screen.getByTestId('agent-roster')).toBeInTheDocument();
    expect(screen.getByText('Frontend Agent')).toBeInTheDocument();
    expect(screen.getByText('Working on step 2')).toBeInTheDocument();
  });

  it('falls back to the role when there is no current task', () => {
    const { currentTask: _drop, ...rest } = agent();
    useRunStore.setState({ agents: [rest] });
    renderWithProviders(<AgentRoster />);
    expect(screen.getByText('Implements UI changes')).toBeInTheDocument();
  });

  it('states status as text, not colour alone', () => {
    useRunStore.setState({
      agents: [agent(), { ...agent(), id: asAgentId('a2'), status: 'done' as const }],
    });
    renderWithProviders(<AgentRoster />);
    expect(screen.getByTestId('agent-card-a1')).toHaveTextContent('Working');
    expect(screen.getByTestId('agent-card-a2')).toHaveTextContent('Done');
  });

  it('is an labelled region so screen readers can jump to it', () => {
    useRunStore.setState({ agents: [agent()] });
    renderWithProviders(<AgentRoster />);
    expect(screen.getByRole('region', { name: 'Agents' })).toBeInTheDocument();
  });
});

describe('AgentRoster — duration and controls', () => {
  beforeEach(() => {
    useRunStore.setState({ agents: [], phase: 'idle', runId: null });
  });

  it('shows elapsed time for an agent that has started', () => {
    useRunStore.setState({
      agents: [{ ...agent(), startedAt: Date.now() - 5000 }],
    });
    renderWithProviders(<AgentRoster />);
    expect(screen.getByTestId('agent-duration-a1')).toHaveTextContent(/\d+s/);
  });

  it('omits the duration when the agent never reported a start', () => {
    useRunStore.setState({ agents: [agent()] });
    renderWithProviders(<AgentRoster />);
    expect(screen.queryByTestId('agent-duration-a1')).not.toBeInTheDocument();
  });

  it('disables stop when nothing is running rather than lying', () => {
    useRunStore.setState({ agents: [agent()], phase: 'idle' });
    renderWithProviders(<AgentRoster />);
    expect(screen.getByTestId('agent-stop-a1')).toBeDisabled();
  });

  it('says plainly that stopping cancels the whole run', () => {
    useRunStore.setState({ agents: [agent()] });
    renderWithProviders(<AgentRoster />);
    expect(
      screen.getByTestId('agent-stop-a1').getAttribute('title'),
    ).toMatch(/whole run|not one agent/i);
  });

  it('offers an inspect control per agent', () => {
    useRunStore.setState({ agents: [agent()] });
    renderWithProviders(<AgentRoster />);
    expect(screen.getByTestId('agent-inspect-a1')).toBeInTheDocument();
  });
});
