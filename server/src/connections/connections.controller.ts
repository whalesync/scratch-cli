import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';

// TODO: We need a user id to own connections, but don't have auth set up yet.
// Here's a fake one everyone can share.
const FAKE_GLOBAL_USER_ID = randomUUID();

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post()
  async create(@Body() createConnectionDto: CreateConnectionDto): Promise<Connection> {
    await this.connectionsService.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.connectionsService.create(createConnectionDto, FAKE_GLOBAL_USER_ID);
  }

  @Get()
  async findAll(): Promise<Connection[]> {
    console.log('findAll', FAKE_GLOBAL_USER_ID);
    await this.connectionsService.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.connectionsService.findAll(FAKE_GLOBAL_USER_ID);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Connection> {
    await this.connectionsService.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.connectionsService.findOne(id, FAKE_GLOBAL_USER_ID);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateConnectionDto: UpdateConnectionDto): Promise<Connection> {
    await this.connectionsService.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.connectionsService.update(id, updateConnectionDto, FAKE_GLOBAL_USER_ID);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    await this.connectionsService.ensureFakeUserExists(FAKE_GLOBAL_USER_ID);
    return this.connectionsService.remove(id, FAKE_GLOBAL_USER_ID);
  }
}
