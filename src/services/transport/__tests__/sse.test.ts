import { describe, expect, it } from 'vitest';
import { SseParser } from '../sse';

describe('SseParser', () => {
  it('parses a simple event terminated by a blank line', () => {
    const parser = new SseParser();
    expect(parser.push('data: hello\n\n')).toEqual([
      { event: 'message', data: 'hello' },
    ]);
  });

  it('buffers an event split across network chunks', () => {
    const parser = new SseParser();
    expect(parser.push('data: hel')).toEqual([]);
    expect(parser.push('lo\n')).toEqual([]);
    expect(parser.push('\n')).toEqual([{ event: 'message', data: 'hello' }]);
  });

  it('joins multiple data lines with a newline', () => {
    const parser = new SseParser();
    expect(parser.push('data: one\ndata: two\n\n')).toEqual([
      { event: 'message', data: 'one\ntwo' },
    ]);
  });

  it('honours a named event field', () => {
    const parser = new SseParser();
    expect(parser.push('event: done\ndata: {}\n\n')).toEqual([
      { event: 'done', data: '{}' },
    ]);
  });

  it('ignores comment/heartbeat lines', () => {
    const parser = new SseParser();
    expect(parser.push(': keepalive\n\n')).toEqual([]);
    expect(parser.push('data: x\n\n')).toEqual([{ event: 'message', data: 'x' }]);
  });

  it('strips only a single leading space after the colon', () => {
    const parser = new SseParser();
    expect(parser.push('data:  two spaces\n\n')).toEqual([
      { event: 'message', data: ' two spaces' },
    ]);
  });

  it('handles CRLF and lone CR line endings', () => {
    expect(new SseParser().push('data: a\r\n\r\n')).toEqual([
      { event: 'message', data: 'a' },
    ]);
    expect(new SseParser().push('data: b\r\r')).toEqual([
      { event: 'message', data: 'b' },
    ]);
  });

  it('emits several events from one chunk', () => {
    const parser = new SseParser();
    expect(parser.push('data: a\n\ndata: b\n\n')).toEqual([
      { event: 'message', data: 'a' },
      { event: 'message', data: 'b' },
    ]);
  });

  it('preserves empty data payloads as empty strings', () => {
    const parser = new SseParser();
    expect(parser.push('data:\n\n')).toEqual([{ event: 'message', data: '' }]);
  });

  it('flushes a trailing event with no final blank line', () => {
    const parser = new SseParser();
    expect(parser.push('data: tail')).toEqual([]);
    expect(parser.flush()).toEqual([{ event: 'message', data: 'tail' }]);
  });

  it('resets the event name between events', () => {
    const parser = new SseParser();
    parser.push('event: first\ndata: 1\n\n');
    expect(parser.push('data: 2\n\n')).toEqual([
      { event: 'message', data: '2' },
    ]);
  });
});
