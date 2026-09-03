import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { Explorer } from '../Explorer';
import { SearchPanel } from '../SearchPanel';
import { DiffViewer } from '../DiffViewer';

describe('Explorer', () => {
  it('exposes a tree with treeitem rows', () => {
    renderWithProviders(<Explorer />);
    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(screen.getAllByRole('treeitem').length).toBeGreaterThan(0);
  });

  it('expands and collapses a directory on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Explorer />);

    expect(screen.getByTestId('tree-src/main.tsx')).toBeInTheDocument();
    await user.click(screen.getByTestId('tree-src'));
    expect(screen.queryByTestId('tree-src/main.tsx')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('tree-src'));
    expect(screen.getByTestId('tree-src/main.tsx')).toBeInTheDocument();
  });

  it('marks directory rows with aria-expanded', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Explorer />);
    const row = screen.getByTestId('tree-docs').closest('[role="treeitem"]');
    expect(row).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByTestId('tree-docs'));
    expect(row).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses everything with the collapse-all button', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Explorer />);
    await user.click(screen.getByTestId('explorer-collapse'));
    expect(screen.queryByTestId('tree-src/components')).not.toBeInTheDocument();
    expect(screen.getByTestId('tree-src')).toBeInTheDocument();
  });

  it('moves the selection with the arrow keys', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Explorer />);
    const first = screen.getByTestId('tree-src');
    first.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByTestId('tree-src/components')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(first).toHaveFocus();
  });

  it('keeps a single tab stop in the tree', () => {
    renderWithProviders(<Explorer />);
    const focusable = screen
      .getAllByRole('treeitem')
      .flatMap((item) => within(item).getAllByRole('button'))
      .filter((button) => button.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
  });

  it('shows the git status marker for changed files', () => {
    renderWithProviders(<Explorer />);
    expect(
      within(screen.getByTestId('tree-src/services/runtime.ts')).getByText('A'),
    ).toBeInTheDocument();
  });
});

describe('SearchPanel', () => {
  it('shows an idle hint before any query', () => {
    renderWithProviders(<SearchPanel />);
    expect(screen.queryByTestId('search-summary')).not.toBeInTheDocument();
  });

  it('lists matches and a summary for a query', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchPanel />);
    await user.type(screen.getByTestId('search-input'), 'runtime');
    expect(screen.getByTestId('search-summary')).toBeInTheDocument();
    expect(screen.getAllByRole('mark').length).toBeGreaterThan(0);
  });

  it('reports an empty state when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchPanel />);
    await user.type(screen.getByTestId('search-input'), 'zzz-nope');
    expect(screen.getByTestId('search-empty')).toBeInTheDocument();
  });

  it('announces the summary politely', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SearchPanel />);
    await user.type(screen.getByTestId('search-input'), 'runtime');
    expect(screen.getByTestId('search-summary')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });
});

describe('DiffViewer', () => {
  it('renders the first change by default', () => {
    renderWithProviders(<DiffViewer />);
    expect(screen.getByTestId('diff-table')).toBeInTheDocument();
  });

  it('sums additions and deletions across the change set', () => {
    renderWithProviders(<DiffViewer />);
    const total = screen.getByTestId('changes-total');
    expect(total).toHaveTextContent('+7');
    expect(total).toHaveTextContent('7');
  });

  it('switches the displayed diff when another file is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiffViewer />);
    await user.click(screen.getByTestId('change-src/components/AppShell.tsx'));
    expect(
      screen.getByTestId('change-src/components/AppShell.tsx'),
    ).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('diff-table')).toHaveTextContent('useOldStore');
  });

  it('explains binary files instead of rendering garbage', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiffViewer />);
    await user.click(screen.getByTestId('change-assets/logo.png'));
    expect(screen.getByTestId('diff-binary')).toBeInTheDocument();
    expect(screen.queryByTestId('diff-table')).not.toBeInTheDocument();
  });

  it('marks added and removed rows distinctly for styling and tests', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DiffViewer />);
    await user.click(screen.getByTestId('change-src/services/legacy.ts'));
    const rows = screen
      .getByTestId('diff-table')
      .querySelectorAll('tr[data-kind="removed"]');
    expect(rows).toHaveLength(2);
  });
});

describe('Explorer context menu', () => {
  it('opens on right-click and closes on Escape', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Explorer />);

    fireEvent.contextMenu(screen.getByTestId('tree-src'));
    expect(screen.getByTestId('explorer-menu')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('explorer-menu')).not.toBeInTheDocument();
  });

  it('copies the relative path', () => {
    const writeText = vi.fn((_text: string) => Promise.resolve());
    // navigator.clipboard is a getter-only property in jsdom.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderWithProviders(<Explorer />);

    fireEvent.contextMenu(screen.getByTestId('tree-src'));
    // fireEvent, not userEvent: jsdom has no layout, so it reports the
    // full-screen backdrop as the hit target and refuses the click.
    fireEvent.click(screen.getByTestId('explorer-menu-copy'));

    expect(writeText).toHaveBeenCalledWith('src');
  });

  it('closes when the user clicks outside it', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Explorer />);

    fireEvent.contextMenu(screen.getByTestId('tree-src'));
    await user.click(screen.getByTestId('explorer-menu-backdrop'));

    expect(screen.queryByTestId('explorer-menu')).not.toBeInTheDocument();
  });

  it('marks reveal inert and explains why', () => {
    renderWithProviders(<Explorer />);
    fireEvent.contextMenu(screen.getByTestId('tree-src'));

    const reveal = screen.getByTestId('explorer-menu-reveal');
    expect(reveal).toHaveAttribute('aria-disabled', 'true');
    expect(reveal.getAttribute('title')).toMatch(/desktop shell/i);
  });
});

describe('Diff actions', () => {
  it('copies a unified patch for the active file', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn((_text: string) => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderWithProviders(<DiffViewer />);

    await user.click(screen.getByTestId('diff-copy-patch'));

    const patch = writeText.mock.calls[0]?.[0] ?? '';
    expect(patch).toContain('--- a/');
    expect(patch).toContain('+++ b/');
    expect(patch).toMatch(/^[+\- ]/m);
  });

  it('marks apply actions inert and explains they need the runtime', () => {
    renderWithProviders(<DiffViewer />);
    for (const id of ['diff-accept', 'diff-revert', 'diff-acceptAll']) {
      const button = screen.getByTestId(id);
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button.getAttribute('title')).toMatch(/managed runtime/i);
    }
  });
});
