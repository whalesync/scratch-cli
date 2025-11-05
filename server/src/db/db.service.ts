import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import knex, { Knex } from 'knex';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';

@Injectable()
export class DbService implements OnModuleInit, OnApplicationShutdown {
  private _client: PrismaClient;

  constructor(private readonly config: ScratchpadConfigService) {
    this._client = new PrismaClient({
      datasources: { db: { url: this.config.getDatabaseUrl() } },
    });
  }

  public get client(): PrismaClient {
    return this._client;
  }

  /**
   * Creates a Knex instance with proper SSL configuration for CloudSQL.
   * Removes sslmode from connection string as it overrides the ssl object config.
   * We still use SSL but configure it via the ssl object to disable cert verification.
   * See https://node-postgres.com/features/ssl#usage-with-connectionstring
   */
  public knexClient(options?: { searchPath?: string[] }): Knex {
    const connectionString = this.config.getDatabaseUrl();
    const url = new URL(connectionString);

    // sslmode=allow means attempt an insecure connection first, so it implies we don't need it
    // and sslmode=disable means don't use it at all.
    const needsSsl = !['disable', 'allow'].includes(url.searchParams.get('sslmode') ?? 'disable');
    if (needsSsl) {
      // Delete the param so we can customize the SSL configuration in the client options
      url.searchParams.delete('sslmode');
    }

    return knex({
      client: 'pg',
      connection: {
        connectionString: url.toString(),
        ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      },
      searchPath: options?.searchPath ?? ['public'],
      debug: this.config.getDbDebug(),
      asyncStackTraces: true,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this._client.$connect();
    } catch (error: unknown) {
      WSLogger.error({
        source: 'DbService.onModuleInit',
        message: 'Failed to connect to DB',
        error,
      });
      process.exit(1);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this._client.$disconnect();
  }
}
