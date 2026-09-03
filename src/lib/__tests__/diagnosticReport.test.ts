import { describe, expect, it } from 'vitest';
import { buildDiagnosticReport, redactSecrets } from '../diagnosticReport';

describe('redactSecrets', () => {
  it('redacts values behind secret-looking keys, whatever the casing', () => {
    const redacted = redactSecrets({
      apiKey: 'sk-live-123',
      API_KEY: 'sk-live-456',
      'x-api-key': 'sk-live-789',
      password: 'hunter2',
      accessToken: 'abc',
      sessionId: 'sid-1',
      safe: 'keep me',
    }) as Record<string, unknown>;

    for (const key of [
      'apiKey',
      'API_KEY',
      'x-api-key',
      'password',
      'accessToken',
      'sessionId',
    ]) {
      expect(redacted[key]).toBe('[redacted]');
    }
    expect(redacted['safe']).toBe('keep me');
  });

  it('redacts nested and array-held secrets', () => {
    const redacted = redactSecrets({
      outer: { inner: [{ token: 'abc' }] },
    }) as { outer: { inner: { token: string }[] } };

    expect(redacted.outer.inner[0]?.token).toBe('[redacted]');
  });

  it('redacts inline secrets not behind a suspicious key', () => {
    expect(redactSecrets('Authorization: Bearer abc.def.ghi')).toBe(
      'Authorization: Bearer [redacted]',
    );
    expect(redactSecrets('contact me at user@example.com')).toContain(
      '[redacted]',
    );
  });

  it('stops recursing on deeply nested structures', () => {
    let nested: unknown = 'leaf';
    for (let i = 0; i < 20; i++) nested = { next: nested };
    expect(() => redactSecrets(nested)).not.toThrow();
  });

  it('leaves ordinary values untouched', () => {
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets(null)).toBe(null);
    expect(redactSecrets('a plain sentence')).toBe('a plain sentence');
  });
});

describe('buildDiagnosticReport', () => {
  it('states plainly that no provider is connected', () => {
    const report = buildDiagnosticReport([]);
    expect(report).toContain('no provider connected');
    expect(report).toContain('Rejected events: 0');
  });

  it('lists each rejected event with its type', () => {
    const report = buildDiagnosticReport([
      { at: 0, reason: 'missing field runId', eventType: 'tool.started' },
    ]);
    expect(report).toContain('tool.started');
    expect(report).toContain('missing field runId');
  });

  it('never emits a secret carried in a rejection reason', () => {
    const report = buildDiagnosticReport([
      { at: 0, reason: 'rejected with token sk-live-abc123', eventType: null },
    ]);
    expect(report).not.toContain('sk-live-abc123');
    expect(report).toContain('[redacted]');
  });
});
