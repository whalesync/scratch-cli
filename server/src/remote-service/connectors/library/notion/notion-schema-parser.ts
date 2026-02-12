import { DatabaseObjectResponse, PageObjectResponse } from '@notionhq/client';
import { sanitizeForTableWsId } from '../../ids';
import { TablePreview } from '../../types';

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
}
