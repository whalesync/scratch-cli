import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { FAKE_GLOBAL_USER_ID } from '../../db/fake_user';
import { ConnectorAccountService } from './connector-account.service';
import { CreateConnectorAccountDto } from './dto/create-connector-account.dto';
import { UpdateConnectorAccountDto } from './dto/update-connector-account.dto';
import { ConnectorAccount } from './entities/connector-account.entity';
import { TableList } from './entities/table-list.entity';
import { TestConnectionResponse } from './entities/test-connection.entity';

@Controller('connector-accounts')
// TODO: Apply auth guard and plumb real user.
// @UseGuards(ScratchpadAuthGuard)
export class ConnectorAccountController {
  constructor(private readonly service: ConnectorAccountService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Post()
  async create(@Body() createDto: CreateConnectorAccountDto, @Req() req: RequestWithUser): Promise<ConnectorAccount> {
    await this.service.ensureFakeUserExists(req.user.id);
    return this.service.create(createDto, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get()
  async findAll(@Req() req: RequestWithUser): Promise<ConnectorAccount[]> {
    await this.service.ensureFakeUserExists(req.user.id);
    return this.service.findAll(req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: RequestWithUser): Promise<ConnectorAccount> {
    await this.service.ensureFakeUserExists(req.user.id);
    return this.service.findOne(id, req.user.id);
  }

  @Post(':id/tables')
  async listTables(@Param('id') id: string): Promise<TableList> {
    return this.service.listTables(id, FAKE_GLOBAL_USER_ID);
  }

  @Post(':id/test')
  async testConnection(@Param('id') id: string, @Req() req: RequestWithUser): Promise<TestConnectionResponse> {
    await this.service.ensureFakeUserExists(req.user.id);
    return this.service.testConnection(id, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateConnectorAccountDto,
    @Req() req: RequestWithUser,
  ): Promise<ConnectorAccount> {
    await this.service.ensureFakeUserExists(req.user.id);
    return this.service.update(id, updateDto, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: RequestWithUser): Promise<void> {
    await this.service.ensureFakeUserExists(req.user.id);
    return this.service.remove(id, req.user.id);
  }
}
