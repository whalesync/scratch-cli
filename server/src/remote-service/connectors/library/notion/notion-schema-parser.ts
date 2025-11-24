import { DatabaseObjectResponse, PageObjectResponse } from '@notionhq/client';
import { sanitizeForColumnWsId, sanitizeForTableWsId } from '../../ids';
import { ColumnMetadata, PostgresColumnType, TablePreview } from '../../types';
import { NotionColumnSpec } from '../custom-spec-registry';

/**
 * These are properties not supported in @notionhq/client:3.1.3
 * Drop this when we upgrade to 4.x.x or 5.x.x
 */
export type NewNotionProperties = ({ type: 'place' } | { type: 'unique_id' } | { type: 'button' }) &
  NotionPropertyFields;
export type NotionPropertyFields = {
  id: string;
  name: string;
};

export type SupportedNotionProperties = DatabaseObjectResponse['properties'][string];

export type NotionProperty = SupportedNotionProperties | NewNotionProperties;

export class NotionSchemaParser {
  parseDatabaseTablePreview(db: DatabaseObjectResponse): TablePreview {
    const displayName = db.title.map((t) => t.plain_text).join('');
    return {
      id: {
        wsId: sanitizeForTableWsId(displayName),
        remoteId: [db.id],
      },
      displayName: displayName,
      metadata: {
        notionType: 'database',
      },
    };
  }

  parsePageTablePreview(page: PageObjectResponse): TablePreview {
    let pageTitle: string | undefined = undefined;

    const titleProperty = Object.values(page.properties).find((property) => property.type === 'title');
    if (titleProperty && titleProperty.title.length > 0) {
      pageTitle = titleProperty.title[0].plain_text;
    }

    const displayName = pageTitle ?? page.id;
    return {
      id: {
        wsId: sanitizeForTableWsId(displayName),
        remoteId: [page.id],
      },
      displayName: displayName,
      metadata: {
        notionType: 'page',
      },
    };
  }

  parseColumn(property: NotionProperty): NotionColumnSpec {
    const pgType = this.getPostgresType(property);
    const readonly = this.isColumnReadonly(property);
    const metadata = this.getColumnMetadata(property);
    return {
      id: {
        wsId: sanitizeForColumnWsId(property.name),
        remoteId: [property.id],
      },
      name: property.name,
      pgType,
      readonly,
      notionDataType: property.type,
      metadata,
    };
  }

  private getColumnMetadata(property: NotionProperty): ColumnMetadata | undefined {
    switch (property.type) {
      case 'number':
        return { numberFormat: 'decimal' };

      case 'rich_text':
        return { textFormat: 'rich_text' };

      case 'date':
      case 'created_time':
      case 'last_edited_time':
        return { dateFormat: 'datetime' };

      case 'url':
        return { textFormat: 'url' };

      case 'phone_number':
        return { textFormat: 'phone' };

      case 'email':
        return { textFormat: 'email' };
      case 'select':
        return {
          options: property.select.options.map((o) => ({ label: o.name, value: o.name })),
          allowAnyOption: true,
        };
      case 'multi_select':
        return {
          options: property.multi_select.options.map((o) => ({ label: o.name, value: o.name })),
          allowAnyOption: true,
        };
      default:
        return undefined;
    }
  }

  private getPostgresType(property: NotionProperty): PostgresColumnType {
    switch (property.type) {
      case 'number':
        return PostgresColumnType.NUMERIC;
      case 'date':
      case 'created_time':
      case 'last_edited_time':
        return PostgresColumnType.TIMESTAMP;
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
      case 'people':
      case 'files':
      case 'url':
      case 'email':
      case 'phone_number':
      case 'created_by':
      case 'last_edited_by':
      default:
        return PostgresColumnType.TEXT;
    }
  }

  private isColumnReadonly(property: NotionProperty): boolean {
    switch (property.type) {
      case 'formula':
      case 'rollup':
      case 'created_time':
      case 'created_by':
      case 'last_edited_time':
      case 'last_edited_by':
      case 'unique_id':
      case 'button':
      case 'place':
        return true;

      default:
        return false;
    }
  }
}
