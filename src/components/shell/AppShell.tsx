import { ChatArea } from '@/components/chat/ChatArea';
import { Inspector } from '@/components/inspector/Inspector';
import { CommandPalette } from '@/components/palette/CommandPalette';
import { SettingsDialog } from '@/components/settings/SettingsDialog';
import { ShortcutsDialog } from '@/components/settings/ShortcutsDialog';
import { useEffect } from 'react';
import { bootstrapOllama } from '@/services/ollama/bootstrap';
import { useAppearance } from '@/hooks/useAppearance';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ActivityRail } from './ActivityRail';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';

export function AppShell(): React.ReactElement {
  useAppearance();
  useKeyboardShortcuts();

  // Probe Ollama once on mount and install the real transport under Tauri.
  useEffect(() => {
    bootstrapOllama();
  }, []);

  return (
    <div
      data-testid="app-shell"
      className="flex h-screen w-screen flex-col overflow-hidden"
    >
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <ActivityRail />
        <Sidebar />
        <ChatArea />
        <Inspector />
      </div>
      <StatusBar />
      <CommandPalette />
      <SettingsDialog />
      <ShortcutsDialog />
    </div>
  );
}
