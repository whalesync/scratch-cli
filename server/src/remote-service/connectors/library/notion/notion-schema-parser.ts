import { DatabaseObjectResponse } from '@notionhq/client';
import { sanitizeForWsId } from '../../ids';
import { PostgresColumnType, TablePreview } from '../../types';
import { NotionColumnSpec } from '../custom-spec-registry';

export class NotionSchemaParser {
  parseTablePreview(db: DatabaseObjectResponse): TablePreview {
    const displayName = db.title.map((t) => t.plain_text).join('');
    return {
      id: {
        wsId: sanitizeForWsId(displayName),
        remoteId: [db.id],
      },
      displayName: displayName,
    };
  }

  parseColumn(property: DatabaseObjectResponse['properties'][string]): NotionColumnSpec {
    const pgType = this.getPostgresType(property);
    const readonly = this.isColumnReadonly(property);
    return {
      id: {
        wsId: sanitizeForWsId(property.name),
        remoteId: [property.id],
      },
      name: property.name,
      pgType,
      readonly,
      markdown: property.type === 'rich_text',
      notionDataType: property.type,
    };
  }

  private getPostgresType(property: DatabaseObjectResponse['properties'][string]): PostgresColumnType {
    switch (property.type) {
      case 'number':
        return PostgresColumnType.NUMERIC;
      case 'checkbox':
        return PostgresColumnType.BOOLEAN;
      case 'multi_select':
        return PostgresColumnType.TEXT_ARRAY;
      case 'relation':
        return PostgresColumnType.TEXT_ARRAY;

      case 'formula':
        // The result type of a formula is not available in the database property.
        // We'll have to treat it as TEXT.
        return PostgresColumnType.TEXT;

      case 'rollup':
        // The notion API says for rollup: "The value of a rollup property is an object with a type key and a key corresponding to the value of type."
        // The type can be 'number', 'date', or 'array'. The array can contain any other property type. This is complex.
        // For now, let's use JSONB to be safe, as we do for Airtable.
        return PostgresColumnType.JSONB;

      case 'title':
      case 'rich_text':
      case 'select':
      case 'status':
      case 'date':
      case 'people':
      case 'files':
      case 'url':
      case 'email':
      case 'phone_number':
      case 'created_time':
      case 'created_by':
      case 'last_edited_time':
      case 'last_edited_by':
      default:
        return PostgresColumnType.TEXT;
    }
  }

  private isColumnReadonly(property: DatabaseObjectResponse['properties'][string]): boolean {
    switch (property.type) {
      case 'formula':
      case 'rollup':
      case 'created_time':
      case 'created_by':
      case 'last_edited_time':
      case 'last_edited_by':
        return true;

      default:
        return false;
    }
  }
}
