import { sanitizeForTableWsId } from '../../../ids';
import { EntityId, PostgresColumnType, TablePreview } from '../../../types';
import { WixBlogColumnSpec, WixBlogTableSpec } from '../../custom-spec-registry';

export class WixBlogSchemaParser {
  parseTablePreview(): TablePreview {
    return {
      id: {
        wsId: sanitizeForTableWsId('wix-blog'),
        remoteId: ['wix-blog'],
      },
      displayName: 'Blog Posts',
    };
  }

  parseTableSpec(): WixBlogTableSpec {
    const id: EntityId = {
      wsId: sanitizeForTableWsId('wix-blog'),
      remoteId: ['wix-blog'],
    };

    const columns: WixBlogColumnSpec[] = [
      {
        id: {
          wsId: 'title',
          remoteId: ['title'],
        },
        name: 'Title',
        pgType: PostgresColumnType.TEXT,
        required: true,
        readonly: false,
        metadata: { textFormat: 'long_text' },
        wixFieldType: 'PlainText',
      },
      {
        id: {
          wsId: 'excerpt',
          remoteId: ['excerpt'],
        },
        name: 'Excerpt',
        pgType: PostgresColumnType.TEXT,
        required: false,
        readonly: false,
        metadata: { textFormat: 'long_text' },
        wixFieldType: 'PlainText',
      },
      {
        id: {
          wsId: 'richContent',
          remoteId: ['richContent'],
        },
        name: 'Content',
        pgType: PostgresColumnType.TEXT,
        required: false,
        readonly: false,
        metadata: { textFormat: 'html' },
        dataConverterTypes: ['html', 'wix'],
        wixFieldType: 'RichText',
      },
      {
        id: {
          wsId: 'seoSlug',
          remoteId: ['seoSlug'],
        },
        name: 'SEO Slug',
        pgType: PostgresColumnType.TEXT,
        required: false,
        readonly: false,
        metadata: { textFormat: 'long_text' },
        wixFieldType: 'PlainText',
      },
      {
        id: {
          wsId: 'featured',
          remoteId: ['featured'],
        },
        name: 'Featured',
        pgType: PostgresColumnType.BOOLEAN,
        readonly: false,
      },
    ];

    return {
      id,
      slug: id.wsId,
      name: 'Blog Posts',
      columns,
      titleColumnRemoteId: ['title'],
    };
  }
}
