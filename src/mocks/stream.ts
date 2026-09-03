import { findModel } from '@/services/runtime/fixtures';

const REPLIES: string[] = [
  `Good question. Here is how I would approach it:

1. Start from the smallest reproducible case.
2. Add a failing test that captures the behaviour.
3. Fix the code until the test passes, then refactor.

\`\`\`ts
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
\`\`\`

This keeps the change reviewable and prevents a regression later.`,
  `Short answer: keep state close to where it is used.

- Server state belongs in TanStack Query.
- Ephemeral UI state belongs in component state.
- Cross-cutting workspace state belongs in a small Zustand store.

Mixing all three in one global object is what makes desktop apps hard to reason about.`,
  `Here is a minimal implementation you can drop in:

\`\`\`tsx
export function useDebounced<T>(value: T, delay = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
\`\`\`

Remember to clear the timer on unmount, otherwise you leak a pending update.`,
  `I would split this into three commits so the review stays readable:

**1. Extract the panel primitives** — no behaviour change.
**2. Introduce the resizable sidebar** — with the persisted width.
**3. Wire the keyboard shortcuts** — including the command palette entries.

Each commit stays green on its own, which makes bisecting trivial later.`,
];

export interface MockStreamOptions {
  prompt: string;
  modelId: string;
  signal: AbortSignal;
  onChunk: (chunk: string) => void;
  /** Overridable for deterministic tests. */
  delayMs?: number;
  seed?: number;
}

export function pickReply(prompt: string, seed?: number): string {
  const index =
    seed !== undefined
      ? seed % REPLIES.length
      : Math.abs(hash(prompt)) % REPLIES.length;
  return REPLIES[index] ?? REPLIES[0]!;
}

function hash(value: string): number {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) {
    out = (out << 5) - out + value.charCodeAt(i);
    out |= 0;
  }
  return out;
}

/** Splits text into human-looking streaming chunks (words + punctuation). */
export function toChunks(text: string): string[] {
  return text.match(/\s*\S+/g) ?? [];
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const id = setTimeout(() => {
      // Detach on the happy path too: one signal spans a whole stream, so
      // leaving a listener per chunk would accumulate for the entire run.
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

export interface MockStreamResult {
  text: string;
  tokens: number;
  latencyMs: number;
  aborted: boolean;
}

/** Simulates a token-by-token LLM response. Resolves when done or aborted. */
export async function runMockStream(
  options: MockStreamOptions,
): Promise<MockStreamResult> {
  const { prompt, modelId, signal, onChunk } = options;
  const model = findModel(modelId);
  const base =
    options.delayMs ??
    (model?.badge === 'fast' ? 12 : model?.badge === 'reasoning' ? 38 : 22);

  const reply = pickReply(prompt, options.seed);
  const chunks = toChunks(reply);
  const started = Date.now();
  let text = '';

  try {
    for (const chunk of chunks) {
      if (signal.aborted) break;
      await sleep(base, signal);
      text += chunk;
      onChunk(chunk);
    }
  } catch {
    return {
      text,
      tokens: estimateTokens(text),
      latencyMs: Date.now() - started,
      aborted: true,
    };
  }

  return {
    text,
    tokens: estimateTokens(text),
    latencyMs: Date.now() - started,
    aborted: signal.aborted,
  };
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length / 4));
}
