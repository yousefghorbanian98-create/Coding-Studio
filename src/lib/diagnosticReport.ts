import type { RuntimeDiagnostic } from '@/services/runtime';

/**
 * Keys whose values must never appear in a report the user might paste into a
 * bug tracker. Matched case-insensitively as a substring, so `apiKey`,
 * `API_KEY` and `x-api-key` are all covered.
 */
const SECRET_KEY_PATTERN =
  /(pass(word|phrase)?|secret|token|key|credential|auth|cookie|session[-_]?id|bearer)/i;

const REDACTED = '[redacted]';

/** Recursively replaces secret-looking values with a placeholder. */
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 8) return REDACTED;

  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item, depth + 1));
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? REDACTED : redactSecrets(item, depth + 1),
      ]),
    );
  }

  if (typeof value === 'string') {
    // Catch inline secrets such as "Authorization: Bearer abc.def" that are
    // not behind a suspicious key.
    return value
      .replace(/\b(bearer|token|key)\s+\S+/gi, `$1 ${REDACTED}`)
      .replace(/\b[\w.-]+@[\w.-]+\.\w+\b/g, REDACTED);
  }

  return value;
}

/**
 * Builds a plain-text diagnostic report. Only schema-validation failures are
 * included; no credential, provider key or user content is ever emitted.
 */
export function buildDiagnosticReport(
  diagnostics: readonly RuntimeDiagnostic[],
): string {
  const lines = [
    'Coding Studio diagnostic report',
    `Generated: ${new Date().toISOString()}`,
    'Runtime: mock (no provider connected)',
    `Rejected events: ${String(diagnostics.length)}`,
    '',
  ];

  for (const entry of diagnostics) {
    const reason = redactSecrets(entry.reason);
    lines.push(
      `- ${new Date(entry.at).toISOString()} ${entry.eventType ?? 'unknown'}: ${String(reason)}`,
    );
  }

  return lines.join('\n');
}
