import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TitleBar } from '@/components/shell/TitleBar';
import { renderWithProviders, resetStores } from '@/test/render';

/**
 * The Tauri window API is only present inside the desktop shell, so we stub the
 * module and flip the `__TAURI_INTERNALS__` marker that `isTauri()` looks for.
 */
const win = {
  isMaximized: vi.fn(() => Promise.resolve(false)),
  minimize: vi.fn(() => Promise.resolve()),
  toggleMaximize: vi.fn(() => Promise.resolve()),
  close: vi.fn(() => Promise.resolve()),
  startDragging: vi.fn(() => Promise.resolve()),
  onResized: vi.fn(() => Promise.resolve(() => {})),
};

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => win,
}));

function enterTauri(): void {
  (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] = {};
}

function leaveTauri(): void {
  delete (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'];
}

describe('custom title bar window controls', () => {
  beforeEach(() => {
    resetStores();
    leaveTauri();
    Object.values(win).forEach((fn) => fn.mockClear());
    win.isMaximized.mockResolvedValue(false);
  });

  it('hides native window buttons in a plain browser', () => {
    renderWithProviders(<TitleBar />);
    expect(screen.getByTestId('title-bar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Minimize' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('renders the window buttons inside the Tauri shell', async () => {
    enterTauri();
    renderWithProviders(<TitleBar />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Minimize' })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Maximize' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('calls minimize on the native window', async () => {
    enterTauri();
    const user = userEvent.setup();
    renderWithProviders(<TitleBar />);

    await user.click(await screen.findByRole('button', { name: 'Minimize' }));
    await waitFor(() => expect(win.minimize).toHaveBeenCalledTimes(1));
  });

  it('calls toggleMaximize and reflects the restore state', async () => {
    enterTauri();
    const user = userEvent.setup();
    renderWithProviders(<TitleBar />);

    await user.click(await screen.findByRole('button', { name: 'Maximize' }));
    await waitFor(() => expect(win.toggleMaximize).toHaveBeenCalledTimes(1));
  });

  it('shows Restore instead of Maximize when the window is maximized', async () => {
    enterTauri();
    win.isMaximized.mockResolvedValue(true);
    renderWithProviders(<TitleBar />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Restore' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: 'Maximize' })).toBeNull();
  });

  it('calls close on the native window', async () => {
    enterTauri();
    const user = userEvent.setup();
    renderWithProviders(<TitleBar />);

    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => expect(win.close).toHaveBeenCalledTimes(1));
  });

  it('starts a native drag from the title bar drag region', async () => {
    enterTauri();
    renderWithProviders(<TitleBar />);
    const bar = await screen.findByTestId('title-bar');

    const { fireEvent } = await import('@testing-library/react');
    fireEvent.pointerDown(bar);
    await waitFor(() => expect(win.startDragging).toHaveBeenCalledTimes(1));
  });
});
