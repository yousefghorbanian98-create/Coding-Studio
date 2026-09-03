export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  modelId?: string;
  tokens?: number;
  latencyMs?: number;
  streaming?: boolean;
  stopped?: boolean;
  /** The run was still streaming when the app closed and cannot be resumed. */
  interrupted?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  pinned?: boolean;
  archived?: boolean;
  messages: ChatMessage[];
}

export interface ModelInfo {
  id: string;
  name: string;
  vendor: string;
  contextK: number;
  description: string;
  badge?: 'fast' | 'balanced' | 'reasoning';
}
