import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useCopyFeedback } from '../useCopyFeedback';

function Probe(): React.ReactElement {
  const { copied, copy } = useCopyFeedback(1500);
  return (
    <button
      type="button"
      data-testid="probe"
      onClick={() => {
        copy('hello');
      }}
    >
      {copied ? 'copied' : 'idle'}
    </button>
  );
}

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  writeText = vi.fn((_text: string) => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCopyFeedback', () => {
  it('confirms the copy and then resets on its own', async () => {
    render(<Probe />);
    await act(async () => {
      screen.getByTestId('probe').click();
      await Promise.resolve();
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('copied');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('idle');
  });

  it('writes the given text to the clipboard', async () => {
    render(<Probe />);
    await act(async () => {
      screen.getByTestId('probe').click();
      await Promise.resolve();
    });
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('clears the pending reset timer on unmount', async () => {
    const { unmount } = render(<Probe />);
    await act(async () => {
      screen.getByTestId('probe').click();
      await Promise.resolve();
    });
    // A reset is now scheduled.
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    // If it survives unmount it fires setState on a dead component. React no
    // longer warns about that, so the timer itself is what must be asserted.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stays quiet when the clipboard is denied', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    render(<Probe />);
    await act(async () => {
      screen.getByTestId('probe').click();
      await Promise.resolve();
    });
    expect(screen.getByTestId('probe')).toHaveTextContent('idle');
  });
});
