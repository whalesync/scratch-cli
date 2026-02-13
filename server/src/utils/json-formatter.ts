/** Formats a JSON object with 2-space indentation and a trailing newline. */
export function formatJsonWithPrettier(data: Record<string, unknown>): string {
  return JSON.stringify(data, null, 2) + '\n';
}
