import { isArray } from 'lodash';
import { sanitizeForColumnWsId, sanitizeForTableWsId } from '../../ids';
import { EntityId, PostgresColumnType } from '../../types';
import { WordPressColumnSpec } from '../custom-spec-registry';
import {
  WORDPRESS_EXCLUDE_COLUMN_ID_SUBSTRINGS,
  WORDPRESS_EXCLUDE_TABLE_SLUGS,
  WORDPRESS_FOREIGN_KEY_COLUMN_IDS,
  WORDPRESS_HIDDEN_COLUMN_IDS,
  WORDPRESS_REMOTE_CUSTOM_FIELDS_ID,
} from './wordpress-constants';
import {
  WordPressArgument,
  WordPressDataType,
  WordPressEndpointOptionsResponse,
  WordPressGetTypesApiResponse,
} from './wordpress-types';

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

export function parseColumnsFromTableId(
  tableId: string,
  endpointOptionsResponse: WordPressEndpointOptionsResponse,
): WordPressColumnSpec[] {
  if (
    endpointOptionsResponse === undefined ||
    endpointOptionsResponse.schema === undefined ||
    endpointOptionsResponse.schema.properties === undefined
  ) {
    throw new Error(`Failed to get schema for WordPress table: ${tableId}`);
  }

  const properties = endpointOptionsResponse.schema.properties;
  const columnNames = Object.keys(properties);
  const columns: WordPressColumnSpec[] = [];

  for (const columnName of columnNames) {
    if (WORDPRESS_HIDDEN_COLUMN_IDS.includes(columnName)) {
      continue;
    }
    if (WORDPRESS_EXCLUDE_COLUMN_ID_SUBSTRINGS.find((e) => columnName.includes(e)) !== undefined) {
      continue;
    }

    const arg = properties[columnName];
    if (arg !== undefined && columnName !== '') {
      if (arg.context !== undefined) {
        const viewContext = arg.context.find((c) => c === 'view');
        const editContext = arg.context.find((c) => c === 'edit');
        // Weirdly enough these fields are not readable but we can edit them
        if (viewContext === undefined && editContext !== undefined) {
          arg.readonly = false;
          arg.writeOnly = true;
        }
        // We need to make sure password and username are writeOnce
        if (columnName === 'password' || columnName === 'username') {
          arg.writeOnce = true;
        } else if (editContext === undefined && viewContext === undefined) {
          continue;
        }
      }

      // Handle ACF (Advanced Custom Fields)
      if (columnName === WORDPRESS_REMOTE_CUSTOM_FIELDS_ID) {
        if (arg.properties !== undefined) {
          const acfColumnNames = Object.keys(arg.properties);
          for (const acfColumnName of acfColumnNames) {
            const acfArg = arg.properties[acfColumnName];
            if (acfArg !== undefined && acfColumnName !== '') {
              const acfColumn = parseColumnFromArgument(acfColumnName, acfArg, true);
              columns.push(acfColumn);
            }
          }
        }
      } else {
        const column = parseColumnFromArgument(columnName, arg, false);
        columns.push(column);
      }
    }
  }

  return columns;
}

function parseColumnFromArgument(columnId: string, arg: WordPressArgument, isAcf: boolean): WordPressColumnSpec {
  const dataType = parseTypeFromArgument(columnId, arg, isAcf);
  const readonly = arg.readonly !== undefined ? arg.readonly : false;

  // Determine PostgreSQL type based on WordPress data type
  let pgType: PostgresColumnType;
  let metadata: WordPressColumnSpec['metadata'] = {};
  let dataConverterTypes: WordPressColumnSpec['dataConverterTypes'] = [];
  switch (dataType) {
    case WordPressDataType.INTEGER:
      pgType = PostgresColumnType.NUMERIC;
      metadata = { numberFormat: 'integer' };
      break;
    case WordPressDataType.NUMBER:
      pgType = PostgresColumnType.NUMERIC;
      metadata = { numberFormat: 'decimal' };
      break;
    case WordPressDataType.BOOLEAN:
      pgType = PostgresColumnType.BOOLEAN;
      break;
    case WordPressDataType.ARRAY:
    case WordPressDataType.FOREIGN_KEY:
      // Check if it's an array type
      if (isArray(arg.type) && arg.type.includes('array')) {
        pgType = PostgresColumnType.TEXT_ARRAY;
      } else if (arg.type === 'array') {
        pgType = PostgresColumnType.TEXT_ARRAY;
      } else {
        pgType = PostgresColumnType.TEXT;
      }
      break;
    case WordPressDataType.RENDERED:
      pgType = PostgresColumnType.TEXT;
      metadata = { textFormat: 'html' };
      dataConverterTypes = Object.values(WORDPRESS_RICH_TEXT_TARGET);
      break;
    case WordPressDataType.RENDERED_INLINE:
      pgType = PostgresColumnType.TEXT;
      metadata = { textFormat: 'html' };
      dataConverterTypes = Object.values(WORDPRESS_RICH_TEXT_TARGET);
      break;
    case WordPressDataType.EMAIL:
      pgType = PostgresColumnType.TEXT;
      metadata = { textFormat: 'email' };
      break;
    case WordPressDataType.URI:
      pgType = PostgresColumnType.TEXT;
      metadata = { textFormat: 'url' };
      break;
    case WordPressDataType.DATE:
      pgType = PostgresColumnType.TEXT;
      metadata = { dateFormat: 'date' };
      break;
    case WordPressDataType.DATETIME:
      pgType = PostgresColumnType.TEXT;
      metadata = { dateFormat: 'datetime' };
      break;
    case WordPressDataType.ENUM:
      pgType = PostgresColumnType.TEXT;
      break;
    case WordPressDataType.STRING:
      pgType = PostgresColumnType.TEXT;
      break;
    case WordPressDataType.OBJECT:
    case WordPressDataType.UNKNOWN:
    default:
      pgType = PostgresColumnType.TEXT;
      break;
  }

  // Handle enum values
  if (arg.enum !== undefined) {
    const enumList = [...arg.enum];
    // Special case for status field
    if (columnId === 'status') {
      enumList.push('inherit');
    }
    metadata = {
      options: enumList.map((value) => ({
        value,
        label: value,
      })),
    };
  }

  return {
    id: {
      wsId: sanitizeForColumnWsId(columnId),
      remoteId: [columnId],
    },
    name: formatColumnName(columnId),
    pgType,
    readonly,
    metadata,
    wordpressDataType: dataType,
    dataConverterTypes,
  };
}

function parseTypeFromArgument(columnId: string, arg: WordPressArgument, isAcf: boolean): WordPressDataType {
  if (arg.type === undefined) {
    return WordPressDataType.UNKNOWN;
  }
  if (arg.enum !== undefined) {
    return WordPressDataType.ENUM;
  }

  let type = arg.type;
  if (isArray(type)) {
    if (type.includes('array')) {
      type = 'array';
    } else if (type.includes('object')) {
      type = 'object';
    } else {
      // Find first non-null type
      const nonNullType = type.find((t) => t !== 'null');
      type = nonNullType ?? 'string';
    }
  }

  // Check for rendered object
  if (arg.properties !== undefined && arg.properties['rendered'] !== undefined) {
    if (columnId === 'title') {
      // Special case the title column as rendered inline so it isn't wrapped in HTML
      return WordPressDataType.RENDERED_INLINE;
    }
    return WordPressDataType.RENDERED;
  }

  // Check for foreign keys
  if (!isAcf && WORDPRESS_FOREIGN_KEY_COLUMN_IDS.find((fk) => fk.remoteColumnId === columnId) !== undefined) {
    return WordPressDataType.FOREIGN_KEY;
  }

  switch (type) {
    case 'string':
      if (arg.format === undefined) {
        return WordPressDataType.STRING;
      }
      switch (arg.format) {
        case 'email':
          return WordPressDataType.EMAIL;
        case 'uri':
          return WordPressDataType.URI;
        case 'date':
          return WordPressDataType.DATE;
        case 'date-time':
          return WordPressDataType.DATETIME;
        default:
          return WordPressDataType.STRING;
      }
    case 'array':
      return WordPressDataType.ARRAY;
    case 'integer':
      return WordPressDataType.INTEGER;
    case 'number':
      return WordPressDataType.NUMBER;
    case 'boolean':
      return WordPressDataType.BOOLEAN;
    case 'object':
      return WordPressDataType.OBJECT;
    default:
      return WordPressDataType.UNKNOWN;
  }
}

function formatColumnName(columnId: string): string {
  return columnId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
