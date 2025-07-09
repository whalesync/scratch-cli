import { WSLogger } from 'src/logger';
import { sanitizeForWsId } from '../../ids';
import { PostgresColumnType, TablePreview } from '../../types';
import { AirtableColumnSpec } from '../custom-spec-registry';
import { AirtableBase, AirtableDataType, AirtableFieldsV2, AirtableTableV2 } from './airtable-types';

export class AirtableSchemaParser {
  parseTablePreview(base: AirtableBase, table: AirtableTableV2): TablePreview {
    return {
      id: {
        wsId: sanitizeForWsId(table.name),
        remoteId: [base.id, table.id],
      },
      displayName: `${base.name} - ${table.name}`,
    };
  }

  parseColumn(field: AirtableFieldsV2): AirtableColumnSpec {
    const pgType = this.getPostgresType(field);
    const readonly = this.isColumnReadonly(field);
    WSLogger.debug({ source: 'AirtableSchemaParser', message: 'Parsing column', field, pgType, readonly });
    return {
      id: {
        wsId: sanitizeForWsId(field.name),
        remoteId: [field.id],
      },
      name: field.name,
      pgType,
      readonly,
    };
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

      // TEXT types
      case AirtableDataType.SINGLE_LINE_TEXT:
      case AirtableDataType.EMAIL:
      case AirtableDataType.URL:
      case AirtableDataType.MULTILINE_TEXT:
      case AirtableDataType.PHONE_NUMBER:
      case AirtableDataType.SINGLE_SELECT:
      case AirtableDataType.SINGLE_COLLABORATOR:
      case AirtableDataType.DATE:
      case AirtableDataType.DATE_TIME:
      case AirtableDataType.CREATED_TIME:
      case AirtableDataType.LAST_MODIFIED_TIME:
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
