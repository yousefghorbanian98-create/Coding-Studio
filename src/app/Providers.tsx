import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DirectionProvider } from '@base-ui-components/react/direction-provider';
import { LANGUAGE_DIRECTION } from '@/i18n';
import { usePreferences } from '@/stores/preferences';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }): React.ReactElement {
  const [queryClient] = useState(createQueryClient);
  const language = usePreferences((s) => s.language);

  return (
    <QueryClientProvider client={queryClient}>
      <DirectionProvider direction={LANGUAGE_DIRECTION[language]}>
        {children}
      </DirectionProvider>
    </QueryClientProvider>
  );
}
