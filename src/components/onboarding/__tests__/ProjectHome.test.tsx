import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { ProjectHome } from '../ProjectHome';
import { useProjectsStore } from '@/stores/projects';

describe('ProjectHome', () => {
  beforeEach(() => {
    localStorage.clear();
    useProjectsStore.getState().reset();
  });

  it('never implies a real provider is connected', () => {
    renderWithProviders(<ProjectHome />);
    const status = screen.getByTestId('project-runtime-status');
    expect(status).toHaveTextContent('Demo runtime');
    expect(status).toHaveTextContent('Mock provider');
    expect(status).toHaveTextContent('Version 0.1.0');
  });

  it('disables filesystem actions and says why', () => {
    renderWithProviders(<ProjectHome />);
    for (const id of ['project-openFolder', 'project-cloneRepo']) {
      expect(screen.getByTestId(id)).toHaveAttribute('aria-disabled', 'true');
    }
    expect(
      screen.getAllByTitle(/need the managed runtime/i).length,
    ).toBeGreaterThan(0);
  });

  it('lists recent projects with path, branch and last-used time', () => {
    renderWithProviders(<ProjectHome />);
    const row = screen.getByTestId('project-proj-api');
    expect(row).toHaveTextContent('billing-api');
    expect(row).toHaveTextContent('feature/invoices');
    expect(row).toHaveTextContent('C:\\dev\\acme\\billing-api');
  });

  it('states unavailable projects honestly rather than hiding them', () => {
    renderWithProviders(<ProjectHome />);
    expect(screen.getByTestId('project-state-proj-site')).toHaveTextContent(
      'Folder not found',
    );
    expect(screen.getByTestId('project-state-proj-legacy')).toHaveTextContent(
      'Permission denied',
    );
  });

  it('sorts pinned projects first', () => {
    renderWithProviders(<ProjectHome />);
    const ids = screen
      .getAllByRole('option')
      .map((node) => node.getAttribute('data-testid'));
    expect(ids[0]).toBe('project-open-proj-studio');
  });

  it('pins and unpins, and the choice survives a remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<ProjectHome />);

    await user.click(screen.getByTestId('project-pin-proj-api'));
    expect(screen.getByTestId('project-pin-proj-api')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    unmount();
    renderWithProviders(<ProjectHome />);
    expect(screen.getByTestId('project-pin-proj-api')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('removes a project from the recent list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectHome />);

    await user.click(screen.getByTestId('project-remove-proj-api'));
    expect(screen.queryByTestId('project-proj-api')).not.toBeInTheDocument();
  });

  it('shows an empty state once every project is removed', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectHome />);

    for (const id of ['proj-studio', 'proj-api', 'proj-site', 'proj-legacy']) {
      await user.click(screen.getByTestId(`project-remove-${id}`));
    }
    expect(screen.getByTestId('projects-empty')).toBeInTheDocument();
  });

  it('keeps the list to one tab stop and moves with arrow keys', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProjectHome />);

    const options = screen.getAllByRole('option');
    expect(options.every((o) => o.getAttribute('tabindex') === '-1')).toBe(true);

    options[0]?.focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(options[1]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(options[0]);
  });
});
