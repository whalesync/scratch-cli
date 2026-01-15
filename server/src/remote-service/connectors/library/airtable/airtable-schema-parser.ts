import { WSLogger } from 'src/logger';
import { sanitizeForTableWsId } from '../../ids';
import { ColumnMetadata, PostgresColumnType, TablePreview } from '../../types';
import { AirtableColumnSpec } from '../custom-spec-registry';
import { AirtableBase, AirtableDataType, AirtableFieldsV2, AirtableTableV2 } from './airtable-types';

export class AirtableSchemaParser {
  parseTablePreview(base: AirtableBase, table: AirtableTableV2): TablePreview {
    return {
      id: {
        wsId: sanitizeForTableWsId(table.name),
        remoteId: [base.id, table.id],
      },
      displayName: `${base.name} - ${table.name}`,
    };
  }

  parseColumn(field: AirtableFieldsV2): AirtableColumnSpec {
    const pgType = this.getPostgresType(field);
    const readonly = this.isColumnReadonly(field);
    const metadata = this.getColumnMetadata(field);

    WSLogger.debug({ source: 'AirtableSchemaParser', message: 'Parsing column', field, pgType, readonly });
    return {
      id: {
        wsId: field.name,
        remoteId: [field.name, field.id],
      },
      slug: field.name,
      name: field.name,
      pgType,
      readonly,
      metadata,
      airtableFieldType: field.type,
    };
  }

  /**
   * Discovers the main content column with the following priority:
   * 1. First richText field (best for formatted content)
   * 2. multilineText field with content-related name (content, body, description, etc.)
   * 3. First non-title multilineText field
   * 4. First non-title singleLineText field as fallback
   */
  discoverMainContentColumn(columns: AirtableColumnSpec[], titleColumnSlug?: string): string[] | undefined {
    // Priority 1: First richText field
    const richTextField = columns.find((col) => col.airtableFieldType === AirtableDataType.RICH_TEXT);
    if (richTextField) {
      return richTextField.id.remoteId;
    }

    // Priority 2: multilineText field with content-related name
    const contentKeywords = [
      'content',
      'body',
      'description',
      'summary',
      'excerpt',
      'bio',
      'about',
      'text',
      'details',
      'notes',
    ];
    const namedContentField = columns.find(
      (col) =>
        col.airtableFieldType === AirtableDataType.MULTILINE_TEXT &&
        col.slug !== titleColumnSlug &&
        col.slug &&
        contentKeywords.some((keyword) => col.slug!.toLowerCase().includes(keyword)),
    );
    if (namedContentField) {
      return namedContentField.id.remoteId;
    }

    // Priority 3: First non-title multilineText field
    const fallbackMultilineField = columns.find(
      (col) => col.airtableFieldType === AirtableDataType.MULTILINE_TEXT && col.slug !== titleColumnSlug,
    );
    if (fallbackMultilineField) {
      return fallbackMultilineField.id.remoteId;
    }

    // Priority 4: First non-title singleLineText field as last resort
    const fallbackSingleLineField = columns.find(
      (col) => col.airtableFieldType === AirtableDataType.SINGLE_LINE_TEXT && col.slug !== titleColumnSlug,
    );
    if (fallbackSingleLineField) {
      return fallbackSingleLineField.id.remoteId;
    }

    return undefined;
  }
  private getColumnMetadata(field: AirtableFieldsV2): ColumnMetadata | undefined {
    const type = field.type as AirtableDataType;

    switch (type) {
      // NUMERIC types
      case AirtableDataType.NUMBER:
      case AirtableDataType.PERCENT:
      case AirtableDataType.CURRENCY:
        return { numberFormat: 'decimal' };

      case AirtableDataType.RATING:
        return { numberFormat: 'integer' };

      case AirtableDataType.DURATION:
        return { numberFormat: 'integer' };

      case AirtableDataType.COUNT:
        return { numberFormat: 'integer' };

      case AirtableDataType.AUTO_NUMBER:
        return { numberFormat: 'integer' };

      case AirtableDataType.DATE:
      case AirtableDataType.DATE_TIME:
      case AirtableDataType.CREATED_TIME:
      case AirtableDataType.LAST_MODIFIED_TIME:
        return { dateFormat: 'datetime' };

      // TEXT types
      case AirtableDataType.EMAIL:
        return { textFormat: 'email' };

      case AirtableDataType.URL:
        return { textFormat: 'url' };

      case AirtableDataType.PHONE_NUMBER:
        return { textFormat: 'phone' };

      case AirtableDataType.MULTILINE_TEXT:
        return { textFormat: 'rich_text' };

      case AirtableDataType.RICH_TEXT:
        if (field.name.toLowerCase().endsWith('_md')) {
          return { textFormat: 'markdown' };
        }
        return { textFormat: 'rich_text' };

      default:
        return undefined;
    }
  }

  private getPostgresType(field: AirtableFieldsV2): PostgresColumnType {
    const type = field.type as AirtableDataType;

    switch (type) {
      // Recursive types
      case AirtableDataType.FORMULA:
      case AirtableDataType.ROLLUP:
        if (field.options?.result) {
          return this.getPostgresType(field.options.result);
        }
        // Fallback for formula/rollup without result type.
        return PostgresColumnType.TEXT;

      // Array Types
      case AirtableDataType.LOOKUP:
      case AirtableDataType.MULTIPLE_LOOKUP_VALUES:
        if (field.options?.result) {
          const underlyingType = this.getPostgresType(field.options.result);
          switch (underlyingType) {
            case PostgresColumnType.TEXT:
              return PostgresColumnType.TEXT_ARRAY;
            case PostgresColumnType.NUMERIC:
              return PostgresColumnType.NUMERIC_ARRAY;
            case PostgresColumnType.BOOLEAN:
              return PostgresColumnType.BOOLEAN_ARRAY;
            default:
              // For anything else (including existing arrays), just use JSONB as it is complex.
              return PostgresColumnType.JSONB;
          }
        }
        return PostgresColumnType.JSONB; // fallback

      case AirtableDataType.MULTIPLE_COLLABORATORS: // array of strings (emails)
      case AirtableDataType.MULTIPLE_SELECTS: // array of strings
        return PostgresColumnType.TEXT_ARRAY;

      case AirtableDataType.MULTIPLE_ATTACHMENTS: // array of objects
        return PostgresColumnType.JSONB;

      case AirtableDataType.MULTIPLE_RECORD_LINKS:
        // This can be single or multiple.
        if (field.options?.prefersSingleRecordLink) {
          return PostgresColumnType.TEXT; // a single ID
        }
        return PostgresColumnType.TEXT_ARRAY;

      // NUMERIC types
      case AirtableDataType.NUMBER:
      case AirtableDataType.PERCENT:
      case AirtableDataType.CURRENCY:
      case AirtableDataType.RATING:
      case AirtableDataType.DURATION:
      case AirtableDataType.COUNT:
      case AirtableDataType.AUTO_NUMBER:
        return PostgresColumnType.NUMERIC;

      // BOOLEAN types
      case AirtableDataType.CHECKBOX:
        return PostgresColumnType.BOOLEAN;

      // DATE types
      case AirtableDataType.DATE:
      case AirtableDataType.DATE_TIME:
      case AirtableDataType.CREATED_TIME:
      case AirtableDataType.LAST_MODIFIED_TIME:
        return PostgresColumnType.TIMESTAMP;

      // TEXT types
      case AirtableDataType.SINGLE_LINE_TEXT:
      case AirtableDataType.EMAIL:
      case AirtableDataType.URL:
      case AirtableDataType.MULTILINE_TEXT:
      case AirtableDataType.PHONE_NUMBER:
      case AirtableDataType.SINGLE_SELECT:
      case AirtableDataType.SINGLE_COLLABORATOR:
      case AirtableDataType.CREATED_BY:
      case AirtableDataType.LAST_MODIFIED_BY:
      case AirtableDataType.BARCODE:
      case AirtableDataType.RICH_TEXT:
      case AirtableDataType.BUTTON:
      case AirtableDataType.AI_TEXT:
      case AirtableDataType.EXTERNAL_SYNC_SOURCE:
      case AirtableDataType.UNKNOWN:
      default:
        return PostgresColumnType.TEXT;
    }
  }

  private isColumnReadonly(field: AirtableFieldsV2): boolean {
    const type = field.type as AirtableDataType;

    switch (type) {
      case AirtableDataType.FORMULA:
      case AirtableDataType.ROLLUP:
      case AirtableDataType.COUNT:
      case AirtableDataType.LOOKUP:
      case AirtableDataType.CREATED_TIME:
      case AirtableDataType.LAST_MODIFIED_TIME:
      case AirtableDataType.CREATED_BY:
      case AirtableDataType.LAST_MODIFIED_BY:
      case AirtableDataType.AUTO_NUMBER:
      case AirtableDataType.BUTTON:
      case AirtableDataType.AI_TEXT:
      case AirtableDataType.EXTERNAL_SYNC_SOURCE:
        return true;

      default:
        return false;
    }
  }
}
