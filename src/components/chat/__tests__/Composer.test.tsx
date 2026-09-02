import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { Composer } from '../Composer';
import { ModeSelector } from '../ModeSelector';
import { useChatStore } from '@/stores/chat';
import { useRuntimeStore } from '@/stores/runtime';

beforeEach(() => {
  localStorage.clear();
  useRuntimeStore.setState({ mode: 'ask' });
  useChatStore.setState({ isStreaming: false });
});

describe('Composer', () => {
  it('disables sending while the input is empty', () => {
    renderWithProviders(<Composer />);
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('enables sending once text is entered', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Composer />);

    await user.type(screen.getByTestId('composer-input'), 'Hello');
    expect(screen.getByTestId('send-button')).toBeEnabled();
  });

  it('submits with Enter and clears the field', async () => {
    const user = userEvent.setup();
    const send = vi.fn(() => Promise.resolve());
    useChatStore.setState({ sendMessage: send });
    renderWithProviders(<Composer />);

    const input = screen.getByTestId('composer-input');
    await user.type(input, 'Explain the shell{Enter}');

    expect(send).toHaveBeenCalledWith('Explain the shell');
    expect(input).toHaveValue('');
  });

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const user = userEvent.setup();
    const send = vi.fn(() => Promise.resolve());
    useChatStore.setState({ sendMessage: send });
    renderWithProviders(<Composer />);

    const input = screen.getByTestId('composer-input');
    await user.type(input, 'line one{Shift>}{Enter}{/Shift}line two');

    expect(send).not.toHaveBeenCalled();
    expect(input).toHaveValue('line one\nline two');
  });

  it('does not send whitespace only', async () => {
    const user = userEvent.setup();
    const send = vi.fn(() => Promise.resolve());
    useChatStore.setState({ sendMessage: send });
    renderWithProviders(<Composer />);

    await user.type(screen.getByTestId('composer-input'), '   {Enter}');
    expect(send).not.toHaveBeenCalled();
  });

  it('shows the stop button while streaming', () => {
    useChatStore.setState({ isStreaming: true });
    renderWithProviders(<Composer />);

    expect(screen.getByTestId('stop-button')).toBeInTheDocument();
    expect(screen.queryByTestId('send-button')).not.toBeInTheDocument();
  });

  it('stops the run when the stop button is pressed', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    useChatStore.setState({ isStreaming: true, stopStreaming: stop });
    renderWithProviders(<Composer />);

    await user.click(screen.getByTestId('stop-button'));
    expect(stop).toHaveBeenCalled();
  });

  it('persists a draft and restores it on remount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Composer />);

    await user.type(screen.getByTestId('composer-input'), 'unsent thought');
    expect(localStorage.getItem('coding-studio:draft')).toBe('unsent thought');

    unmount();
    renderWithProviders(<Composer />);
    expect(screen.getByTestId('composer-input')).toHaveValue('unsent thought');
  });
});

describe('ModeSelector', () => {
  it('marks the active mode for assistive technology', () => {
    renderWithProviders(<ModeSelector />);
    expect(screen.getByTestId('mode-ask')).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByTestId('mode-agent')).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('switches mode on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeSelector />);

    await user.click(screen.getByTestId('mode-plan'));
    expect(useRuntimeStore.getState().mode).toBe('plan');
  });

  it('moves through the modes with the arrow keys', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeSelector />);

    screen.getByTestId('mode-ask').focus();
    await user.keyboard('{ArrowRight}');
    expect(useRuntimeStore.getState().mode).toBe('plan');

    await user.keyboard('{ArrowLeft}');
    expect(useRuntimeStore.getState().mode).toBe('ask');
  });

  it('wraps around at the ends', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModeSelector />);

    screen.getByTestId('mode-ask').focus();
    await user.keyboard('{ArrowLeft}');
    expect(useRuntimeStore.getState().mode).toBe('agent');
  });

  it('exposes a single tab stop', () => {
    renderWithProviders(<ModeSelector />);
    expect(screen.getByTestId('mode-ask')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('mode-plan')).toHaveAttribute('tabindex', '-1');
  });
});
