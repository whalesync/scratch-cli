import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConnectorAccountService } from './connector-account.service';
import { CreateConnectorAccountDto } from './dto/create-connector-account.dto';
import { UpdateConnectorAccountDto } from './dto/update-connector-account.dto';
import { ConnectorAccount } from './entities/connector-account.entity';
import { TestConnectionResponse } from './entities/test-connection.entity';

// TODO: We need a user id to own ConnectorAccount, but don't have auth set up yet.
// Here's a fake one everyone can share.
const FAKE_GLOBAL_USER_ID = randomUUID();

@Controller('connector-accounts')
export class ConnectorAccountController {
  constructor(private readonly service: ConnectorAccountService) {}

  @Post()
  async create(@Body() createDto: CreateConnectorAccountDto): Promise<ConnectorAccount> {
    await this.service.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.service.create(createDto, FAKE_GLOBAL_USER_ID);
  }

  @Get()
  async findAll(): Promise<ConnectorAccount[]> {
    await this.service.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.service.findAll(FAKE_GLOBAL_USER_ID);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<ConnectorAccount> {
    await this.service.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.service.findOne(id, FAKE_GLOBAL_USER_ID);
  }

  @Post(':id/test')
  async testConnection(@Param('id') id: string): Promise<TestConnectionResponse> {
    await this.service.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.service.testConnection(id, FAKE_GLOBAL_USER_ID);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDto: UpdateConnectorAccountDto): Promise<ConnectorAccount> {
    await this.service.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.service.update(id, updateDto, FAKE_GLOBAL_USER_ID);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.service.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.service.remove(id, FAKE_GLOBAL_USER_ID);
  }
}
