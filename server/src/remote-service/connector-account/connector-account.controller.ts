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
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  CreateConnectorAccountDto,
  UpdateConnectorAccountDto,
  WorkbookId,
  type ValidatedCreateConnectorAccountDto,
} from '@spinner/shared-types';
import { ScratchAuthGuard } from '../../auth/scratch-auth.guard';
import type { RequestWithUser } from '../../auth/types';
import { userToActor } from '../../users/types';
import { ConnectorAccountService } from './connector-account.service';
import { ConnectorAccount } from './entities/connector-account.entity';
import { TableList, TableSearchResult } from './entities/table-list.entity';
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

  @Get(':id')
  async findOne(
    @Param('workbookId') workbookId: string,
    @Param('id') id: string,
    @Req() req: RequestWithUser,
  ): Promise<ConnectorAccount> {
    return this.service.findOne(workbookId as WorkbookId, id, userToActor(req.user));
  }

  @Get(':connectorAccountId/tables')
  async listTables(
    @Param('workbookId') workbookId: string,
    @Param('connectorAccountId') connectorAccountId: string,
    @Req() req: RequestWithUser,
  ): Promise<TableList> {
    return this.service.listTables(connectorAccountId, userToActor(req.user));
  }

  @Get(':connectorAccountId/tables/search')
  async searchTables(
    @Param('connectorAccountId') connectorAccountId: string,
    @Query('searchTerm') searchTerm: string,
    @Req() req: RequestWithUser,
  ): Promise<TableSearchResult> {
    return this.service.searchTables(connectorAccountId, searchTerm, userToActor(req.user));
  }

  @Get(':id/supabase/projects')
  async listSupabaseProjects(@Param('id') id: string, @Req() req: RequestWithUser) {
    const projects = await this.service.listSupabaseProjects(id, userToActor(req.user));
    return { projects };
  }

  @Post(':id/supabase/setup')
  async setupSupabaseProject(
    @Param('workbookId') workbookId: string,
    @Param('id') id: string,
    @Body() body: { projectRef: string },
    @Req() req: RequestWithUser,
  ) {
    await this.service.setupSupabaseProject(workbookId as WorkbookId, id, body.projectRef, userToActor(req.user));
    return { success: true };
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
