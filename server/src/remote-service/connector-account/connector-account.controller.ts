import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ScratchpadAuthGuard } from '../../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../../auth/types';
import { toActor } from '../../auth/types';
import { ConnectorAccountService } from './connector-account.service';
import { CreateConnectorAccountDto } from './dto/create-connector-account.dto';
import { ListTablesDto } from './dto/list-tables.dto';
import { UpdateConnectorAccountDto } from './dto/update-connector-account.dto';
import { ConnectorAccount } from './entities/connector-account.entity';
import { TableList } from './entities/table-list.entity';
import { TestConnectionResponse } from './entities/test-connection.entity';

@Controller('connector-accounts')
@UseGuards(ScratchpadAuthGuard)
export class ConnectorAccountController {
  constructor(private readonly service: ConnectorAccountService) {}

  @Post()
  async create(@Body() createDto: CreateConnectorAccountDto, @Req() req: RequestWithUser): Promise<ConnectorAccount> {
    return this.service.create(createDto, toActor(req.user));
  }

  @Get()
  async findAll(@Req() req: RequestWithUser): Promise<ConnectorAccount[]> {
    return this.service.findAll(toActor(req.user));
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser): Promise<ConnectorAccount> {
    return this.service.findOne(id, toActor(req.user));
  }

  @Post('tables')
  async listTables(@Body() dto: ListTablesDto, @Req() req: RequestWithUser): Promise<TableList> {
    const tables = await this.service.listTables(dto.service, dto.connectorAccountId ?? null, toActor(req.user));
    return { tables };
  }

  @Post(':id/test')
  async testConnection(@Param('id') id: string, @Req() req: RequestWithUser): Promise<TestConnectionResponse> {
    return this.service.testConnection(id, toActor(req.user));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateConnectorAccountDto,
    @Req() req: RequestWithUser,
  ): Promise<ConnectorAccount> {
    return this.service.update(id, updateDto, toActor(req.user));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    return this.service.remove(id, toActor(req.user));
  }
}
