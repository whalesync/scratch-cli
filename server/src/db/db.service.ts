/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from 'generated/prisma';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';

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
      console.error('Failed to connect to DB: ', error);
      process.exit(1);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this._client.$disconnect();
  }
}
