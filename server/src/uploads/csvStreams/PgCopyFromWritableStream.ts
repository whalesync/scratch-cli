/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Knex } from 'knex';
import { from as copyFrom } from 'pg-copy-streams';
import { WSLogger } from 'src/logger';
import { Writable } from 'stream';

const source = 'PgCopyFromWritableStream';
export class PgCopyFromWritableStream extends Writable {
  private copyStream: any;
  private connection: any;

  constructor(
    private readonly table: string,
    private readonly columnNames: string[],
    private readonly client: Knex.Client,
  ) {
    super();
  }

  async connect() {
    try {
      this.connection = await this.client.acquireConnection();

      // Create the COPY stream
      this.copyStream = this.connection.query(
        copyFrom(
          `COPY ${this.table} ("remoteId", ${this.columnNames.map((name: string) => `"${name}"`).join(', ')})
            FROM STDIN
            WITH (FORMAT CSV)`,
        ),
      );

      // Forward COPY stream errors to this writable stream
      this.copyStream.on('error', (error: Error) => {
        WSLogger.error({ message: `COPY stream error: ${error.message}`, source });
        void this.kill();
      });
    } catch (error) {
      WSLogger.error({
        message: `Error initializing COPY stream: ${error instanceof Error ? error.message : String(error)}`,
        source,
      });
      throw error;
    }
  }

  async kill() {
    await this.copyStream.destroy();
  }

  override _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    if (this.copyStream) {
      this.copyStream.write(chunk, encoding, callback);
    } else {
      callback(new Error('COPY stream not initialized'));
    }
  }

  override _final(callback: (error?: Error | null) => void) {
    if (this.copyStream) {
      this.copyStream.end(callback);
    } else {
      callback();
    }
  }
}
