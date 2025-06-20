/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from 'generated/prisma';

@Injectable()
export class DbService implements OnModuleInit, OnApplicationShutdown {
  private _client: PrismaClient;
  private databaseUrl: string;

  constructor() {
    this.databaseUrl = process.env.DATABASE_URL || '';
    this._client = new PrismaClient({
      datasources: { db: { url: this.databaseUrl } },
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
