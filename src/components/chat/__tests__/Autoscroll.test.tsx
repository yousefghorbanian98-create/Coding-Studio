import { beforeEach, describe, expect, it } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { ChatArea } from '../ChatArea';
import { useChatStore } from '@/stores/chat';

/** jsdom gives every element zero size, so the scroll box is faked. */
function sizeScroller(el: HTMLElement, scrollTop: number): void {
  Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 300, configurable: true });
  el.scrollTop = scrollTop;
}

let counter = 0;

function appendMessage(text: string): void {
  const { sessions, activeSessionId } = useChatStore.getState();
  useChatStore.setState({
    sessions: sessions.map((session) =>
      session.id === activeSessionId
        ? {
            ...session,
            messages: [
              ...session.messages,
              {
                id: `appended-${String(counter++)}`,
                role: 'assistant' as const,
                content: text,
                createdAt: 0,
              },
            ],
          }
        : session,
    ),
  });
}

describe('autoscroll', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('follows new messages while the user is at the bottom', () => {
    renderWithProviders(<ChatArea />);
    const scroller = screen.getByTestId('message-scroll');
    sizeScroller(scroller, 700);

    act(() => {
      appendMessage('a new reply');
    });

    expect(scroller.scrollTop).toBe(scroller.scrollHeight);
  });

  it('keeps the reading position when the user has scrolled up', () => {
    renderWithProviders(<ChatArea />);
    const scroller = screen.getByTestId('message-scroll');

    // Scroll far from the bottom and let the handler record it.
    sizeScroller(scroller, 100);
    fireEvent.scroll(scroller);

    act(() => {
      appendMessage('an interrupting reply');
    });

    expect(scroller.scrollTop).toBe(100);
  });

  it('offers Jump to latest only once the user scrolls away', () => {
    renderWithProviders(<ChatArea />);
    const scroller = screen.getByTestId('message-scroll');

    expect(screen.queryByTestId('jump-to-latest')).not.toBeInTheDocument();

    sizeScroller(scroller, 100);
    fireEvent.scroll(scroller);

    expect(screen.getByTestId('jump-to-latest')).toBeInTheDocument();
  });

  it('returns to the bottom and resumes following when jumped', () => {
    renderWithProviders(<ChatArea />);
    const scroller = screen.getByTestId('message-scroll');

    sizeScroller(scroller, 100);
    fireEvent.scroll(scroller);
    fireEvent.click(screen.getByTestId('jump-to-latest'));

    expect(scroller.scrollTop).toBe(scroller.scrollHeight);
    expect(screen.queryByTestId('jump-to-latest')).not.toBeInTheDocument();
  });
});
