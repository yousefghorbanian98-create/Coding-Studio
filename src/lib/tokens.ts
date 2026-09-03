/**
 * Rough token estimate for messages the runtime did not count itself.
 *
 * The runtime reports real token counts on `message.completed`; this is only
 * the fallback for locally-created messages such as the user's own prompt.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.round(text.length / 4));
}
