/**
 * Represents a field/column in a table.
 * Corresponds to FieldInfo in scratch-cli/internal/providers/providers.go
 */
export class FieldInfo {
  id?: string;
  name?: string;
  slug?: string;
  type?: string;
  required?: boolean;
  helpText?: string;
}
