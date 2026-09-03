import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { SettingsDialog } from '../SettingsDialog';
import { useUiStore } from '@/stores/ui';
import { useRuntimeStore } from '@/stores/runtime';
import { defaultPermissions, usePermissions } from '@/stores/permissions';
import { FIXTURE_MODELS, FIXTURE_PROVIDERS } from '@/services/runtime';

beforeEach(() => {
  localStorage.clear();
  usePermissions.setState({ policies: defaultPermissions() });
  useUiStore.setState({ settingsOpen: true });
  useRuntimeStore.setState({
    status: 'ready',
    health: { status: 'ready', kind: 'mock', version: 'mock-1.0.0' },
    providers: [...FIXTURE_PROVIDERS],
    models: FIXTURE_MODELS.filter((m) => m.providerId === 'demo'),
    providerId: 'demo',
    modelId: 'demo-balanced',
    lastCheckedAt: null,
  });
});

describe('section navigation', () => {
  it('opens on Appearance', () => {
    renderWithProviders(<SettingsDialog />);
    expect(screen.getByTestId('settings-panel-appearance')).toBeInTheDocument();
  });

  it('switches sections from the sidebar', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-runtime'));
    expect(screen.getByTestId('settings-panel-runtime')).toBeInTheDocument();
    expect(
      screen.queryByTestId('settings-panel-appearance'),
    ).not.toBeInTheDocument();
  });

  it('moves between sections with the arrow keys and keeps one tab stop', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    screen.getByTestId('settings-nav-appearance').focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('settings-panel-runtime')).toBeInTheDocument();

    const stops = screen
      .getAllByRole('button')
      .filter((b) => b.dataset['testid']?.startsWith('settings-nav-') === true)
      .filter((b) => b.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });

  it('wraps around when arrowing past the last section', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    screen.getByTestId('settings-nav-appearance').focus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByTestId('settings-panel-about')).toBeInTheDocument();
  });
});

describe('runtime section', () => {
  it('reports the mock runtime and its schema version honestly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-runtime'));
    expect(screen.getByTestId('runtime-kind')).toHaveTextContent('mock');
    expect(screen.getByTestId('runtime-version')).toHaveTextContent('mock-1.0.0');
    expect(screen.getByTestId('runtime-schema')).toHaveTextContent('1.0.0');
  });

  it('states that Jcode and Ruflo are not integrated', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-runtime'));
    expect(screen.getByTestId('runtime-jcode')).toHaveTextContent(/not installed/i);
    expect(screen.getByTestId('runtime-ruflo')).toHaveTextContent(/future/i);
  });
});

describe('providers section', () => {
  it('lists every provider with its auth state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-providers'));
    expect(screen.getByTestId('provider-anthropic')).toBeInTheDocument();
    expect(screen.getByTestId('provider-openai')).toBeInTheDocument();
    expect(screen.getByTestId('provider-copilot')).toBeInTheDocument();
    expect(screen.getByTestId('provider-custom')).toBeInTheDocument();
  });

  it('disables unbuilt providers and explains why instead of failing silently', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-providers'));
    const claude = screen.getByTestId('provider-anthropic');
    expect(claude).toBeDisabled();
    expect(claude).toHaveTextContent(/managed runtime/i);
  });

  it('leaves the demo provider selectable and marked as current', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-providers'));
    const demo = screen.getByTestId('provider-demo');
    expect(demo).toBeEnabled();
    expect(demo).toHaveAttribute('aria-current', 'true');
  });

  it('shows a loading state while the runtime is being probed', async () => {
    useRuntimeStore.setState({ status: 'connecting' });
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-providers'));
    expect(screen.getByTestId('providers-loading')).toBeInTheDocument();
  });

  it('shows an empty state when no models are offered', async () => {
    useRuntimeStore.setState({ models: [] });
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-providers'));
    expect(screen.getByTestId('models-empty')).toBeInTheDocument();
  });

  it('promises that no credentials are requested or stored', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-providers'));
    expect(screen.getByTestId('providers-no-credentials')).toHaveTextContent(
      /no API key is requested or stored/i,
    );
  });
});

describe('permissions section', () => {
  it('starts every action on Ask', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-permissions'));
    expect(
      screen.getByTestId('permission-shell-command-ask'),
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('permissions-relaxed')).not.toBeInTheDocument();
  });

  it('warns inline when an action is set to run unattended', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-permissions'));
    await user.click(screen.getByTestId('permission-shell-command-allow'));

    expect(
      screen.getByTestId('permission-warning-shell-command'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('permissions-relaxed')).toBeInTheDocument();
  });

  it('restores the safe defaults', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-permissions'));
    await user.click(screen.getByTestId('permission-delete-allow'));
    await user.click(screen.getByTestId('permissions-reset'));

    expect(screen.getByTestId('permission-delete-ask')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(
      screen.queryByTestId('permission-warning-delete'),
    ).not.toBeInTheDocument();
  });
});

describe('privacy and about', () => {
  it('states that no telemetry or credentials leave the machine', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-privacy'));
    expect(screen.getByTestId('privacy-points')).toHaveTextContent(
      /no analytics or telemetry/i,
    );
    expect(screen.getByTestId('privacy-points')).toHaveTextContent(
      /no API keys or credentials/i,
    );
  });

  it('says plainly that the agent behaviour is mocked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-about'));
    expect(screen.getByTestId('about-honesty')).toHaveTextContent(
      /not integrated yet/i,
    );
  });

  it('names the planned sections rather than shipping empty pages', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    await user.click(screen.getByTestId('settings-nav-about'));
    const future = screen.getByTestId('about-future-sections');
    expect(future).toHaveTextContent('MCP');
    expect(future).toHaveTextContent('Memory');
    expect(screen.queryByTestId('settings-nav-mcp')).not.toBeInTheDocument();
  });
});

describe('no Ollama surface', () => {
  it('never mentions the removed provider anywhere in settings', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsDialog />);
    for (const id of ['runtime', 'providers', 'permissions', 'privacy', 'about']) {
      await user.click(screen.getByTestId(`settings-nav-${id}`));
      expect(
        screen.getByTestId('settings-dialog').textContent?.toLowerCase(),
      ).not.toContain('ollama');
    }
  });
});
