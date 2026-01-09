/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Knex } from 'knex';
import { to as copyTo } from 'pg-copy-streams';
import { Readable } from 'stream';

// Column name for CSV upload index (legacy, kept for backwards compatibility)
const CSV_INDEX_COLUMN = '__index';

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

  // Check if __index column exists in the table (for upload tables)
  // If not, we'll skip ORDER BY or use a different column (for snapshot tables)
  const hasIndexColumn = await knex.schema.withSchema(schema).hasColumn(table, CSV_INDEX_COLUMN);

  // Determine ORDER BY clause: use __index for upload tables, otherwise skip
  // (Snapshot tables use SCRATCH_ID_COLUMN as primary key, but we don't include it in exports)
  const orderByClause = hasIndexColumn ? `ORDER BY "${CSV_INDEX_COLUMN}" ASC` : '';

  const sql = `
    COPY (
      SELECT ${escapedColumns} 
      FROM "${schema}"."${table}"
      ${whereClause} 
      ${orderByClause}
    ) TO STDOUT WITH (FORMAT CSV, HEADER TRUE, QUOTE '"', ESCAPE '"', DELIMITER ',')
  `;

  const knexClient = knex.client as KnexClientPool;
  const conn = await knexClient.acquireConnection();

  // Create the COPY stream
  // Get the raw PostgreSQL client - Knex wraps it, so we need the underlying connection
  // The connection might be at conn.connection (for pooled connections)
  const pgConnection = conn.connection || conn;

  // Create the COPY query and submit it to the connection
  // copyTo returns a CopyToStreamQuery which needs to be submitted to the pg connection
  const copyQuery = copyTo(sql);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  copyQuery.submit(pgConnection);
  const stream = copyQuery;

  // Handle connection errors and forward them to the stream
  conn.on('error', (error: Error) => {
    stream.destroy(error);
  });

  const cleanup = async () => {
    try {
      await knexClient.releaseConnection(conn);
    } catch {
      // Ignore cleanup errors
    }
  };

  return { stream, cleanup };
}
