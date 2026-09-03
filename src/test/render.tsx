import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { createMockSessions } from '@/mocks/sessions';
import { useChatStore } from '@/stores/chat';
import { usePreferences } from '@/stores/preferences';
import { useUiStore } from '@/stores/ui';

export function resetStores(): void {
  const sessions = createMockSessions();
  useChatStore.setState({
    sessions,
    activeSessionId: sessions[0]!.id,
    modelId: sessions[0]!.modelId,
    isStreaming: false,
    selectedMessageId: null,
    filter: '',

  });
  usePreferences.getState().reset();
  useUiStore.setState({
    paletteOpen: false,
    shortcutsOpen: false,
    settingsOpen: false,
    composerFocusToken: 0,
  });
  void i18n.changeLanguage('en');
}

export function renderWithProviders(ui: ReactElement): RenderResult {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
  return render(ui, { wrapper });
}
