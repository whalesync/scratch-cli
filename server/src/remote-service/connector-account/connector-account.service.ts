import { Injectable, NotFoundException } from '@nestjs/common';
import { ConnectorAccount } from '@prisma/client';
import { DbService } from '../../db/db.service';
import { createConnectorAccountId } from '../../types/ids';
import { ConnectorsService } from '../connectors/connectors.service';
import { TableListing } from '../connectors/types';
import { CreateConnectorAccountDto } from './dto/create-connector-account.dto';
import { UpdateConnectorAccountDto } from './dto/update-connector-account.dto';
import { TestConnectionResponse } from './entities/test-connection.entity';

@Injectable()
export class ConnectorAccountService {
  constructor(
    private readonly db: DbService,
    private readonly connectorsService: ConnectorsService,
  ) {}

  async create(createDto: CreateConnectorAccountDto, userId: string): Promise<ConnectorAccount> {
    const connectorAccount = await this.db.client.connectorAccount.create({
      data: {
        id: createConnectorAccountId(),
        userId,
        service: createDto.service,
        displayName: `${createDto.service.toLowerCase()} base`,
        apiKey: createDto.apiKey,
      },
    });
    return connectorAccount;
  }

  async findAll(userId: string): Promise<ConnectorAccount[]> {
    return this.db.client.connectorAccount.findMany({
      where: { userId },
    });
  }

  async findOne(id: string, userId: string): Promise<ConnectorAccount> {
    const connectorAccount = await this.db.client.connectorAccount.findUnique({
      where: { id, userId },
    });
    if (!connectorAccount) {
      throw new NotFoundException('ConnectorAccount not found');
    }
    return connectorAccount;
  }

  async update(id: string, updateDto: UpdateConnectorAccountDto, userId: string): Promise<ConnectorAccount> {
    const account = await this.db.client.connectorAccount.update({
      where: { id, userId },
      data: { ...updateDto, healthStatus: null, healthStatusLastCheckedAt: null },
    });
    return account;
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.db.client.connectorAccount.delete({
      where: { id, userId },
    });
  }

  async listTables(id: string, userId: string): Promise<TableListing[]> {
    const account = await this.findOne(id, userId);
    const connector = this.connectorsService.getConnector(account);
    return connector.listTables(account);
  }

  async testConnection(id: string, userId: string): Promise<TestConnectionResponse> {
    const account = await this.findOne(id, userId);
    const connector = this.connectorsService.getConnector(account);
    try {
      await connector.testConnection();

      await this.db.client.connectorAccount.update({
        where: { id },
        data: {
          healthStatus: 'OK',
          healthStatusLastCheckedAt: new Date(),
        },
      });

      return { health: 'ok' };
    } catch (error: unknown) {
      await this.db.client.connectorAccount.update({
        where: { id },
        data: {
          healthStatus: 'FAILED',
          healthStatusLastCheckedAt: new Date(),
        },
      });

      if (error instanceof Error) {
        return { health: 'error', error: error.message };
      }
      return { health: 'error', error: 'Unknown error' };
    }
  }
}
