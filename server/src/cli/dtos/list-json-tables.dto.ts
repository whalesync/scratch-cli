import { TSchema } from '@sinclair/typebox';

export class JsonTableInfo {
  /** Table ID (joined by '/') */
  id?: string;
  /** Site/Base ID if applicable */
  siteId?: string;
  /** Table name */
  name?: string;
  /** JSON Schema for the table's fields */
  schema?: TSchema;
}

export class ListJsonTablesResponseDto {
  readonly error?: string;
  readonly tables?: JsonTableInfo[];
}
