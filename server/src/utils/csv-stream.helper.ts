/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Knex } from 'knex';
import { to as copyTo } from 'pg-copy-streams';
import { Readable } from 'stream';

type KnexClientPool = {
  acquireConnection: () => Promise<any>;
  releaseConnection: (conn: any) => Promise<void>;
};

export interface CsvStreamOptions {
  knex: Knex;
  schema: string;
  table: string;
  columnNames: string[];
  whereClause?: string;
}

export interface CsvStreamResult {
  stream: Readable;
  cleanup: () => Promise<void>;
}

/**
 * Creates a PostgreSQL COPY TO STDOUT stream for efficient CSV export
 * This helper is used by both snapshot export and upload download endpoints
 */
export async function createCsvStream(options: CsvStreamOptions): Promise<CsvStreamResult> {
  const { knex, schema, table, columnNames, whereClause = '' } = options;

  // Escape column names with double quotes
  const escapedColumns = columnNames.map((name) => `"${name}"`).join(', ');

  const sql = `
    COPY (
      SELECT ${escapedColumns} FROM "${schema}"."${table}"${whereClause}
    ) TO STDOUT WITH (FORMAT CSV, HEADER TRUE, QUOTE '"', ESCAPE '"', DELIMITER ',')
  `;

  const knexClient = knex.client as KnexClientPool;
  const conn = await knexClient.acquireConnection();

  const stream = conn.query(copyTo(sql)) as Readable;

  const cleanup = async () => {
    await knexClient.releaseConnection(conn);
  };

  return { stream, cleanup };
}
