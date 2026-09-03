import { useEffect } from 'react';
import { ChatArea } from '@/components/chat/ChatArea';
import { ProjectHome } from '@/components/onboarding/ProjectHome';
import { usePreferences } from '@/stores/preferences';
import { Inspector } from '@/components/inspector/Inspector';
import { CommandPalette } from '@/components/palette/CommandPalette';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { ShortcutsDialog } from '@/components/settings/ShortcutsDialog';
import { useAppearance } from '@/hooks/useAppearance';
import { useRuntimeStore } from '@/stores/runtime';
import { connectRunStore } from '@/stores/run';
import { ScenarioLab } from '@/components/devtools/ScenarioLab';
import { useScenarioFromUrl } from '@/components/devtools/useScenario';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { BottomPanel } from '@/components/panel/BottomPanel';
import { ActivityRail } from './ActivityRail';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';

export function AppShell(): React.ReactElement {
  useAppearance();
  useKeyboardShortcuts();
  const refresh = useRuntimeStore((s) => s.refresh);

  useScenarioFromUrl();

  // Probe the runtime once on mount so the shell reflects its real state.
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Project runtime events into the run store for the lifetime of the shell.
  // The cleanup keeps StrictMode's double mount from doubling the listeners.
  useEffect(() => connectRunStore(), []);

  const activeRailItem = usePreferences((state) => state.activeRailItem);

  return (
    <div
      data-testid="app-shell"
      className="flex h-screen w-screen flex-col overflow-hidden"
    >
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <ActivityRail />
        <Sidebar />
        {activeRailItem === 'home' ? (
          <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--color-canvas)]">
            <ProjectHome />
          </main>
        ) : (
          <ChatArea />
        )}
        <Inspector />
      </div>
      <BottomPanel />
      <StatusBar />
      <CommandPalette />
      <SettingsDialog />
      <ShortcutsDialog />
      <ScenarioLab />
    </div>
  );
}
