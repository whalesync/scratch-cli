import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
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
