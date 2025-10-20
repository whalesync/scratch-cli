import { Knex } from 'knex';
import { ColumnMetadata, PostgresColumnType } from '../../types';

export class CsvSchemaParser {
  getColumnMetadata(columnName: string, colInfo: Knex.ColumnInfo): ColumnMetadata | undefined {
    if (colInfo.type === 'integer' || colInfo.type === 'bigint') {
      return { numberFormat: 'integer' };
    }

    if (colInfo.type === 'numeric' || colInfo.type === 'decimal' || colInfo.type === 'double precision') {
      return { numberFormat: 'decimal' };
    }

    if (columnName.toLowerCase().endsWith('_md') || columnName.toLowerCase().endsWith('.md')) {
      return { textFormat: 'markdown' };
    }

    if (colInfo.type === 'timestamp' || colInfo.type === 'datetime' || colInfo.type === 'date') {
      return { dateFormat: 'datetime' };
    }

    return undefined;
  }

  getPostgresType(colInfo: Knex.ColumnInfo): PostgresColumnType {
    if (
      colInfo.type === 'integer' ||
      colInfo.type === 'bigint' ||
      colInfo.type === 'numeric' ||
      colInfo.type === 'decimal' ||
      colInfo.type === 'double precision'
    ) {
      return PostgresColumnType.NUMERIC;
    } else if (colInfo.type === 'boolean') {
      return PostgresColumnType.BOOLEAN;
    }
    if (colInfo.type === 'timestamp' || colInfo.type === 'datetime' || colInfo.type === 'date') {
      return PostgresColumnType.TIMESTAMP;
    }
    return PostgresColumnType.TEXT;
  }
}
