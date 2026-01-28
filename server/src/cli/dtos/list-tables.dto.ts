import { TSchema } from '@sinclair/typebox';

export class TableInfo {
  /** Table ID */
  id?: string;
  /** Site/Base ID if applicable */
  siteId?: string;
  /** Site/Base name if applicable */
  siteName?: string;
  /** Table name */
  name?: string;
  /** URL-friendly slug (used for folder name) */
  slug?: string;
  /** JSON Schema for the table's fields */
  schema?: TSchema;
  /** The field name to use as the unique identifier (e.g., 'id', 'uid') */
  idField?: string;
}

export class ListTablesResponseDto {
  readonly error?: string;
  readonly tables?: TableInfo[];
}
