/**
 * Represents a single record from a CMS table.
 * Corresponds to Record in scratch-cli/internal/providers/providers.go
 * Named FileRecord to avoid conflict with TypeScript's built-in Record type.
 */
export class FileRecord {
  id?: string;
  slug?: string;
  rawData?: Record<string, unknown>;
}
