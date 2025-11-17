import _ from 'lodash';
import { Webflow } from 'webflow-api';
import { sanitizeForWsId } from '../../ids';
import { ColumnMetadata, ColumnOptions, EntityId, PostgresColumnType, TablePreview } from '../../types';
import { WebflowColumnSpec, WebflowTableSpec } from '../custom-spec-registry';
import {
  WEBFLOW_CREATED_ON_COLUMN_ID,
  WEBFLOW_IS_ARCHIVED_COLUMN_ID,
  WEBFLOW_IS_DRAFT_COLUMN_ID,
  WEBFLOW_LAST_PUBLISHED_COLUMN_ID,
  WEBFLOW_LAST_UPDATED_COLUMN_ID,
} from './webflow-spec-types';

export class WebflowSchemaParser {
  parseTablePreview(
    site: Webflow.Site,
    collection: Webflow.CollectionListArrayItem | Webflow.Collection,
  ): TablePreview {
    return {
      id: {
        wsId: sanitizeForWsId(collection.id),
        remoteId: [site.id, collection.id],
      },
      displayName: `${site.displayName} - ${collection.displayName}`,
      metadata: {
        siteId: site.id,
        siteName: site.displayName,
        collectionName: collection.displayName,
      },
    };
  }

  parseTableSpec(site: Webflow.Site, collection: Webflow.Collection): WebflowTableSpec {
    const id: EntityId = {
      wsId: sanitizeForWsId(collection.id),
      remoteId: [site.id, collection.id],
    };

    // Find the 'name' field which is typically the title column
    const nameField = collection.fields.find((f) => f.slug === 'name');
    const titleColumnSlug: string[] | undefined = nameField && nameField.slug ? [nameField.slug] : undefined;

    // Parse all collection fields
    const columns = collection.fields.map((field) => this.parseColumn(field, titleColumnSlug?.[0]));

    // Add predefined metadata columns (readonly)
    columns.push(
      {
        id: {
          wsId: WEBFLOW_IS_DRAFT_COLUMN_ID,
          remoteId: [WEBFLOW_IS_DRAFT_COLUMN_ID],
        },
        name: 'Is Draft',
        pgType: PostgresColumnType.BOOLEAN,
        readonly: true,
      },
      {
        id: {
          wsId: WEBFLOW_IS_ARCHIVED_COLUMN_ID,
          remoteId: [WEBFLOW_IS_ARCHIVED_COLUMN_ID],
        },
        name: 'Is Archived',
        pgType: PostgresColumnType.BOOLEAN,
        readonly: true,
      },
      {
        id: {
          wsId: WEBFLOW_LAST_PUBLISHED_COLUMN_ID,
          remoteId: [WEBFLOW_LAST_PUBLISHED_COLUMN_ID],
        },
        name: 'Last Published',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
      {
        id: {
          wsId: WEBFLOW_LAST_UPDATED_COLUMN_ID,
          remoteId: [WEBFLOW_LAST_UPDATED_COLUMN_ID],
        },
        name: 'Last Updated',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
      {
        id: {
          wsId: WEBFLOW_CREATED_ON_COLUMN_ID,
          remoteId: [WEBFLOW_CREATED_ON_COLUMN_ID],
        },
        name: 'Created On',
        pgType: PostgresColumnType.TIMESTAMP,
        readonly: true,
        metadata: { dateFormat: 'datetime' },
      },
    );

    return {
      id,
      slug: id.wsId,
      name: `${site.displayName} - ${collection.displayName}`,
      columns,
      titleColumnRemoteId: titleColumnSlug,
    };
  }

  parseColumn(field: Webflow.Field, titleColumnSlug?: string): WebflowColumnSpec {
    const { pgType, metadata, dataConverterTypes } = this.mapFieldTypeToPgType(field);

    return {
      id: {
        wsId: sanitizeForWsId(field.id),
        remoteId: [field.id],
      },
      slug: field.slug,
      name: field.displayName,
      pgType,
      // The slug field is always required, and it's slug is always slug.
      // other fields are not required except for the title column.
      required: field.slug === 'slug' ? true : titleColumnSlug === field.slug,
      readonly: !field.isEditable,
      metadata,
      dataConverterTypes,
      webflowFieldType: field.type,
    };
  }

  private mapFieldTypeToPgType(field: Webflow.Field): {
    pgType: PostgresColumnType;
    metadata?: ColumnMetadata;
    dataConverterTypes?: string[];
    options?: ColumnOptions[];
  } {
    const type = field.type;
    switch (type) {
      case Webflow.FieldType.PlainText:
        return {
          pgType: PostgresColumnType.TEXT,
          metadata: { textFormat: 'long_text' },
        };

      case Webflow.FieldType.RichText:
        return {
          pgType: PostgresColumnType.TEXT,
          metadata: { textFormat: 'html' },
          dataConverterTypes: ['html'],
        };

      case Webflow.FieldType.Number:
        return {
          pgType: PostgresColumnType.NUMERIC,
          metadata: { numberFormat: 'decimal' },
        };

      case Webflow.FieldType.Switch:
        return {
          pgType: PostgresColumnType.BOOLEAN,
        };

      case Webflow.FieldType.DateTime:
        return {
          pgType: PostgresColumnType.TIMESTAMP,
          metadata: { dateFormat: 'datetime' },
        };

      case Webflow.FieldType.Email:
        return {
          pgType: PostgresColumnType.TEXT,
          metadata: { textFormat: 'email' },
        };

      case Webflow.FieldType.Phone:
        return {
          pgType: PostgresColumnType.TEXT,
          metadata: { textFormat: 'phone' },
        };

      case Webflow.FieldType.Link:
      case Webflow.FieldType.VideoLink:
        return {
          pgType: PostgresColumnType.TEXT,
          metadata: { textFormat: 'url' },
        };

      case Webflow.FieldType.Color:
        return {
          pgType: PostgresColumnType.TEXT,
        };

      case Webflow.FieldType.Option:
        return {
          pgType: PostgresColumnType.TEXT,
          metadata: {
            // Webflow api type is wrong in here, the options are actually an array of objects with id and name (inside validations).
            options: _.get(field.validations, 'options', []).map((option: { id: string; name: string }) => ({
              value: option.id,
              label: option.name,
            })),
          },
        };

      default:
        // Default to JSONB for unknown types
        return {
          pgType: PostgresColumnType.JSONB,
        };
    }
  }
}
