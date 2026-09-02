import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { DirectionProvider } from '@base-ui-components/react/direction-provider';
import { LANGUAGE_DIRECTION } from '@/i18n';
import { createQueryClient } from '@/lib/queryClient';
import { usePreferences } from '@/stores/preferences';

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
