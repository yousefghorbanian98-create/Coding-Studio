import type { ModelInfo } from '@/types/chat';

export const MOCK_MODELS: ModelInfo[] = [
  {
    id: 'studio-sonnet',
    name: 'Studio Sonnet',
    vendor: 'Anthropic',
    contextK: 200,
    description: 'Balanced quality and speed for everyday coding.',
    badge: 'balanced',
  },
  {
    id: 'studio-opus',
    name: 'Studio Opus',
    vendor: 'Anthropic',
    contextK: 200,
    description: 'Deep reasoning for architecture and refactors.',
    badge: 'reasoning',
  },
  {
    id: 'studio-haiku',
    name: 'Studio Haiku',
    vendor: 'Anthropic',
    contextK: 128,
    description: 'Fastest responses for quick edits.',
    badge: 'fast',
  },
  {
    id: 'gpt-studio',
    name: 'GPT Studio',
    vendor: 'OpenAI',
    contextK: 128,
    description: 'General purpose assistant with tool use.',
    badge: 'balanced',
  },
  {
    id: 'local-qwen',
    name: 'Qwen Coder (local)',
    vendor: 'Local',
    contextK: 32,
    description: 'Runs offline on your machine.',
    badge: 'fast',
  },
];

export const DEFAULT_MODEL_ID = 'studio-sonnet';

export function findModel(id: string): ModelInfo | undefined {
  return MOCK_MODELS.find((model) => model.id === id);
}
