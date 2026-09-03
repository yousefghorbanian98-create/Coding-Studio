import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { BottomPanel } from '../BottomPanel';
import { useUiStore } from '@/stores/ui';
import { clearDiagnostics, recordDiagnostic } from '@/services/runtime';

beforeEach(() => {
  clearDiagnostics();
  useUiStore.setState({ panelOpen: true, panelTab: 'terminal' });
});

describe('BottomPanel', () => {
  it('stays out of the layout while closed', () => {
    useUiStore.setState({ panelOpen: false });
    renderWithProviders(<BottomPanel />);
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();
  });

  it('exposes the five tabs as a tablist', () => {
    renderWithProviders(<BottomPanel />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(screen.getByTestId('panel-tab-terminal')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('switches tabs with the arrow keys and keeps one tab stop', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);
    screen.getByTestId('panel-tab-terminal').focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('panel-problems')).toBeInTheDocument();
    expect(
      screen.getAllByRole('tab').filter((t) => t.tabIndex === 0),
    ).toHaveLength(1);
  });

  it('wraps around when arrowing past the last tab', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ panelTab: 'logs' });
    renderWithProviders(<BottomPanel />);
    screen.getByTestId('panel-tab-logs').focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTestId('panel-terminal')).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);
    await user.click(screen.getByTestId('panel-close'));
    expect(screen.queryByTestId('bottom-panel')).not.toBeInTheDocument();
    expect(useUiStore.getState().panelOpen).toBe(false);
  });

  it('runs a known demo command in the terminal', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);
    await user.type(screen.getByTestId('terminal-input'), 'echo hi{Enter}');
    expect(screen.getByTestId('panel-terminal')).toHaveTextContent('hi');
    expect(screen.getByTestId('terminal-input')).toHaveValue('');
  });

  it('explains that an unsupported command is not available', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);
    await user.type(screen.getByTestId('terminal-input'), 'deploy{Enter}');
    expect(screen.getByTestId('panel-terminal')).toHaveTextContent(
      /not available/i,
    );
  });

  it('ignores an empty terminal submission', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);
    const before = screen.getByTestId('panel-terminal').textContent;
    await user.type(screen.getByTestId('terminal-input'), '   {Enter}');
    expect(screen.getByTestId('panel-terminal').textContent).toBe(before);
  });

  it('lists problems with their location', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);
    await user.click(screen.getByTestId('panel-tab-problems'));
    expect(screen.getByTestId('problem-prob-1')).toHaveTextContent(
      'src/components/AppShell.tsx:11:9',
    );
  });

  it('filters output lines by channel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);
    await user.click(screen.getByTestId('panel-tab-output'));
    expect(screen.getByTestId('output-o1')).toBeInTheDocument();
    expect(screen.queryByTestId('output-o3')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('output-channel'), 'Build');
    expect(screen.getByTestId('output-o3')).toBeInTheDocument();
    expect(screen.queryByTestId('output-o1')).not.toBeInTheDocument();
  });

  it('shows an empty agent log when nothing was rejected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BottomPanel />);
    await user.click(screen.getByTestId('panel-tab-logs'));
    expect(screen.getByTestId('logs-empty')).toBeInTheDocument();
  });

  it('lists rejected runtime events in the agent log', async () => {
    const user = userEvent.setup();
    recordDiagnostic({
      at: 1,
      reason: 'invalid payload',
      eventType: 'message.delta',
    });
    renderWithProviders(<BottomPanel />);
    await user.click(screen.getByTestId('panel-tab-logs'));
    expect(screen.getByTestId('panel-logs')).toHaveTextContent('message.delta');
    expect(screen.getByTestId('panel-logs')).toHaveTextContent(
      'invalid payload',
    );
  });
});
