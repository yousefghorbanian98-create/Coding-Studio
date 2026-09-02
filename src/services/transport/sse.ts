/**
 * Incremental Server-Sent Events parser.
 *
 * Network chunks split at arbitrary byte boundaries, so events must be buffered
 * across `push` calls. Follows the WHATWG event-stream rules that matter here:
 * `\r\n`, `\n` and `\r` line endings, `data:` accumulation across lines, a
 * leading space stripped after the colon, and comment lines ignored.
 */
export interface SseEvent {
  event: string;
  data: string;
}

export class SseParser {
  private buffer = '';
  private dataLines: string[] = [];
  private eventName = '';

  /** Feeds a raw chunk and returns any events completed by it. */
  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];

    // Normalise line endings, then consume only complete lines.
    this.buffer = this.buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      const event = this.consumeLine(line);
      if (event) events.push(event);

      newlineIndex = this.buffer.indexOf('\n');
    }

    return events;
  }

  /** Flushes a trailing event that arrived without a final blank line. */
  flush(): SseEvent[] {
    const events: SseEvent[] = [];
    if (this.buffer.length > 0) {
      const event = this.consumeLine(this.buffer);
      this.buffer = '';
      if (event) events.push(event);
    }
    const dispatched = this.dispatch();
    if (dispatched) events.push(dispatched);
    return events;
  }

  private consumeLine(line: string): SseEvent | null {
    // A blank line dispatches the buffered event.
    if (line === '') return this.dispatch();

    // Comments / heartbeats.
    if (line.startsWith(':')) return null;

    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);

    if (field === 'data') this.dataLines.push(value);
    else if (field === 'event') this.eventName = value;

    return null;
  }

  private dispatch(): SseEvent | null {
    if (this.dataLines.length === 0) {
      this.eventName = '';
      return null;
    }
    const event: SseEvent = {
      event: this.eventName || 'message',
      data: this.dataLines.join('\n'),
    };
    this.dataLines = [];
    this.eventName = '';
    return event;
  }
}

/** Reads a byte stream and yields decoded SSE events. */
export async function* readSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();

  try {
    for (;;) {
      if (signal.aborted) return;
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const event of parser.push(text)) yield event;
    }
    for (const event of parser.flush()) yield event;
  } finally {
    reader.releaseLock();
  }
}
