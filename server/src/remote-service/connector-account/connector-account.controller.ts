import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ScratchpadAuthGuard } from '../../auth/scratchpad-auth.guard';
import type { RequestWithUser } from '../../auth/types';
import { toActor } from '../../auth/types';
import { ConnectorAccountService } from './connector-account.service';
import { CreateConnectorAccountDto, type ValidatedCreateConnectorAccountDto } from './dto/create-connector-account.dto';
import { ListTablesDto, ValidatedListTablesDto } from './dto/list-tables.dto';
import { UpdateConnectorAccountDto } from './dto/update-connector-account.dto';
import { ConnectorAccount } from './entities/connector-account.entity';
import { TableGroup, TableList } from './entities/table-list.entity';
import { TestConnectionResponse } from './entities/test-connection.entity';

@Controller('connector-accounts')
@UseGuards(ScratchpadAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ConnectorAccountController {
  constructor(private readonly service: ConnectorAccountService) {}

  @Post()
  async create(@Body() createDto: CreateConnectorAccountDto, @Req() req: RequestWithUser): Promise<ConnectorAccount> {
    const dto = createDto as ValidatedCreateConnectorAccountDto;
    return this.service.create(dto, toActor(req.user));
  }

  @Get()
  async findAll(@Req() req: RequestWithUser): Promise<ConnectorAccount[]> {
    return this.service.findAll(toActor(req.user));
  }

  @Get('all-tables')
  async listAllTables(@Req() req: RequestWithUser): Promise<TableGroup[]> {
    const result = await this.service.listAllUserTables(toActor(req.user));
    return result;
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser): Promise<ConnectorAccount> {
    return this.service.findOne(id, toActor(req.user));
  }

  @Post('tables')
  async listTables(@Body() dtoParam: ListTablesDto, @Req() req: RequestWithUser): Promise<TableList> {
    const dto = dtoParam as ValidatedListTablesDto;
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
    const dto = updateDto;
    return this.service.update(id, dto, toActor(req.user));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    return this.service.remove(id, toActor(req.user));
  }
}
