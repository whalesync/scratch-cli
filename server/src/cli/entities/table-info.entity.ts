import { FieldInfo } from './field-info.entity';

/**
 * Represents a table/collection from a CMS.
 * Corresponds to TableInfo in scratch-cli/internal/providers/providers.go
 */
export class TableInfo {
  id?: string;
  name?: string;
  slug?: string;
  siteId?: string;
  siteName?: string;
  fields?: FieldInfo[];
  systemFields?: FieldInfo[];
  extraInfo?: Record<string, string>;
}
