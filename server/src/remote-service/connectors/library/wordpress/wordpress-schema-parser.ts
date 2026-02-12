import { sanitizeForTableWsId } from '../../ids';
import { EntityId } from '../../types';
import { WORDPRESS_EXCLUDE_TABLE_SLUGS } from './wordpress-constants';
import { WordPressGetTypesApiResponse } from './wordpress-types';

export enum WORDPRESS_RICH_TEXT_TARGET {
  // Default:
  HTML = 'html',
  MARKDOWN = 'markdown',
}

/**
 * Parse the table IDs and display names from the WordPress Types API.
 * The table ID matches the REST endpoint so we can use it directly in subsequent requests.
 */
export function parseTableInfoFromTypes(
  typesResponse: WordPressGetTypesApiResponse,
): { id: EntityId; displayName: string }[] {
  return Object.entries(typesResponse)
    .filter(
      ([, typeData]) =>
        typeData.rest_base && typeData.name && !WORDPRESS_EXCLUDE_TABLE_SLUGS.includes(typeData.slug ?? ''),
    )
    .map(([, typeData]) => {
      return {
        id: {
          wsId: sanitizeForTableWsId(typeData.rest_base),
          remoteId: [typeData.rest_base],
        },
        displayName: typeData.name,
      };
    });
}
