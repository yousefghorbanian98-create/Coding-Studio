import type { ChatSession } from '@/types/chat';

const HOUR = 60 * 60 * 1000;
const BASE = Date.parse('2026-09-01T09:00:00.000Z');

export function createMockSessions(): ChatSession[] {
  return [
    {
      id: 'sess-shell',
      title: 'Application shell layout',
      createdAt: BASE - 2 * HOUR,
      updatedAt: BASE - 20 * 60 * 1000,
      modelId: 'studio-sonnet',
      pinned: true,
      messages: [
        {
          id: 'm-1',
          role: 'system',
          content:
            'You are Coding Studio, a desktop pair-programming assistant.',
          createdAt: BASE - 2 * HOUR,
          tokens: 18,
        },
        {
          id: 'm-2',
          role: 'user',
          content:
            'Sketch an application shell with a title bar, activity rail, sidebar and status bar.',
          createdAt: BASE - 2 * HOUR + 60_000,
          tokens: 24,
        },
        {
          id: 'm-3',
          role: 'assistant',
          modelId: 'studio-sonnet',
          content: `Here is a layout that scales well:

1. **Title bar** — custom, draggable, houses window controls.
2. **Activity rail** — 48px icon column for top-level destinations.
3. **Sidebar** — resizable session list, collapsible to zero.
4. **Main area** — message transcript plus composer.
5. **Inspector** — optional right panel for message metadata.
6. **Status bar** — 24px strip with model, tokens and connection state.

\`\`\`tsx
<AppShell>
  <TitleBar />
  <Workbench>
    <ActivityRail />
    <Sidebar resizable />
    <ChatArea />
    <Inspector optional />
  </Workbench>
  <StatusBar />
</AppShell>
\`\`\`

Keep every panel a CSS grid child so resizing never reflows the transcript.`,
          createdAt: BASE - 2 * HOUR + 92_000,
          tokens: 186,
          latencyMs: 1420,
        },
      ],
    },
    {
      id: 'sess-rtl',
      title: 'RTL and i18n strategy',
      createdAt: BASE - 26 * HOUR,
      updatedAt: BASE - 25 * HOUR,
      modelId: 'studio-opus',
      messages: [
        {
          id: 'm-4',
          role: 'user',
          content: 'How should I handle Persian RTL without duplicating styles?',
          createdAt: BASE - 26 * HOUR,
          tokens: 15,
        },
        {
          id: 'm-5',
          role: 'assistant',
          modelId: 'studio-opus',
          content: `Use logical properties everywhere and let the document direction do the work.

- Set \`dir\` on \`<html>\` from the active language.
- Prefer \`ms-*\`/\`me-*\`, \`ps-*\`/\`pe-*\`, \`start-*\`/\`end-*\` over left/right utilities.
- Mirror only *directional* icons (chevrons, send arrow) with \`rtl:-scale-x-100\`.
- Keep code blocks \`dir="ltr"\` so snippets stay readable in Persian mode.`,
          createdAt: BASE - 25 * HOUR,
          tokens: 132,
          latencyMs: 2310,
        },
      ],
    },
    {
      id: 'sess-tests',
      title: 'Vitest + Playwright setup',
      createdAt: BASE - 50 * HOUR,
      updatedAt: BASE - 49 * HOUR,
      modelId: 'studio-haiku',
      messages: [
        {
          id: 'm-6',
          role: 'user',
          content: 'Give me a testing pyramid for this desktop app.',
          createdAt: BASE - 50 * HOUR,
          tokens: 12,
        },
        {
          id: 'm-7',
          role: 'assistant',
          modelId: 'studio-haiku',
          content: `**Unit (Vitest + Testing Library)** — stores, hooks, pure helpers, single components.

**Integration (Vitest, jsdom)** — shell composition, command palette, keyboard shortcuts.

**End-to-end (Playwright)** — the built web bundle in Chromium: send a message, stop a stream, toggle theme and language.`,
          createdAt: BASE - 49 * HOUR,
          tokens: 88,
          latencyMs: 640,
        },
      ],
    },
    {
      id: 'sess-perf',
      title: 'Virtualising long transcripts',
      createdAt: BASE - 96 * HOUR,
      updatedAt: BASE - 95 * HOUR,
      modelId: 'studio-sonnet',
      messages: [
        {
          id: 'm-8',
          role: 'user',
          content: 'The transcript stutters after ~2k messages. Ideas?',
          createdAt: BASE - 96 * HOUR,
          tokens: 14,
        },
        {
          id: 'm-9',
          role: 'assistant',
          modelId: 'studio-sonnet',
          content: `Three cheap wins before reaching for virtualisation:

1. Memoise each message row and key it by id.
2. Move streaming text into a leaf node so only that node re-renders.
3. Use \`content-visibility: auto\` on off-screen rows.

If you still need more, \`@tanstack/react-virtual\` with dynamic measurement is the natural next step.`,
          createdAt: BASE - 95 * HOUR,
          tokens: 104,
          latencyMs: 1180,
        },
      ],
    },
  ];
}
