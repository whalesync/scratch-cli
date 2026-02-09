/**
 * Formats a JSON object using Prettier configuration.
 * This ensures all JSON written to git is formatted consistently.
 * Uses JSON.stringify with 2-space indentation and adds trailing newline.
 */
export function formatJsonWithPrettier(data: Record<string, unknown>): string {
  // Use JSON.stringify with 2-space indentation (Prettier's default for JSON),
  // sort object keys lexicographically, and add a trailing newline as Prettier does
  const sortKeys = (_key: string, value: unknown): unknown => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return value;
  };
  const formatted = JSON.stringify(data, sortKeys, 2);
  return `${formatted}\n`;
}
