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
import {
  CreateConnectorAccountDto,
  ListTablesDto,
  UpdateConnectorAccountDto,
  ValidatedListTablesDto,
  WorkbookId,
  type ValidatedCreateConnectorAccountDto,
} from '@spinner/shared-types';
import { ScratchAuthGuard } from '../../auth/scratch-auth.guard';
import type { RequestWithUser } from '../../auth/types';
import { userToActor } from '../../users/types';
import { ConnectorAccountService } from './connector-account.service';
import { ConnectorAccount } from './entities/connector-account.entity';
import { TableGroup, TableList } from './entities/table-list.entity';
import { TestConnectionResponse } from './entities/test-connection.entity';

@Controller('workbooks/:workbookId/connections')
@UseGuards(ScratchAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
export class ConnectorAccountController {
  constructor(private readonly service: ConnectorAccountService) {}

  @Post()
  async create(
    @Param('workbookId') workbookId: string,
    @Body() createDto: CreateConnectorAccountDto,
    @Req() req: RequestWithUser,
  ): Promise<ConnectorAccount> {
    const dto = createDto as ValidatedCreateConnectorAccountDto;
    return this.service.create(workbookId as WorkbookId, dto, userToActor(req.user));
  }

  @Get()
  async findAll(@Param('workbookId') workbookId: string, @Req() req: RequestWithUser): Promise<ConnectorAccount[]> {
    return this.service.findAll(workbookId as WorkbookId, userToActor(req.user));
  }

  @Get('all-tables')
  async listAllTables(@Param('workbookId') workbookId: string, @Req() req: RequestWithUser): Promise<TableGroup[]> {
    const result = await this.service.listAllUserTables(workbookId as WorkbookId, userToActor(req.user));
    return result;
  }

  @Get(':id')
  async findOne(
    @Param('workbookId') workbookId: string,
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<ConnectorAccount> {
    return this.service.findOne(workbookId as WorkbookId, id, userToActor(req.user));
  }

  @Post('tables')
  async listTables(
    @Param('workbookId') workbookId: string,
    @Body() dtoParam: ListTablesDto,
    @Req() req: RequestWithUser,
  ): Promise<TableList> {
    const dto = dtoParam as ValidatedListTablesDto;
    const tables = await this.service.listTables(dto.service, dto.connectorAccountId ?? null, userToActor(req.user));
    return { tables };
  }

  @Post(':id/test')
  async testConnection(
    @Param('workbookId') workbookId: string,
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<TestConnectionResponse> {
    return this.service.testConnection(workbookId as WorkbookId, id, userToActor(req.user));
  }

  @Patch(':id')
  async update(
    @Param('workbookId') workbookId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateConnectorAccountDto,
    @Req() req: RequestWithUser,
  ): Promise<ConnectorAccount> {
    const dto = updateDto;
    return this.service.update(workbookId as WorkbookId, id, dto, userToActor(req.user));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('workbookId') workbookId: string,
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    return this.service.remove(workbookId as WorkbookId, id, userToActor(req.user));
  }
}
