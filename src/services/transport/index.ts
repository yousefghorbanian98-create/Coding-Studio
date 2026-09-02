import { MockTransport } from './mockTransport';
import type { ChatTransport } from './types';

export * from './types';
export { MockTransport } from './mockTransport';
export { HttpTransport, type HttpTransportOptions } from './httpTransport';
export { SseParser, readSseStream, type SseEvent } from './sse';

let active: ChatTransport = new MockTransport();

/** The transport the chat store sends through. */
export function getTransport(): ChatTransport {
  return active;
}

/** Swaps the transport — the single call site needed to go live. */
export function setTransport(transport: ChatTransport): void {
  active = transport;
}

/** Restores the built-in mock transport. */
export function resetTransport(): void {
  active = new MockTransport();
}
