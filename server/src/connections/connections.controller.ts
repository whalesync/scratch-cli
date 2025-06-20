import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';

// TODO: Replace this with a real user from an auth guard
class UserFromBody {
  userId: string;
}

@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post()
  create(@Body() createConnectionDto: CreateConnectionDto, @Body() user: UserFromBody) {
    return this.connectionsService.create(createConnectionDto, user.userId);
  }

  @Get()
  findAll(@Body() user: UserFromBody) {
    return this.connectionsService.findAll(user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Body() user: UserFromBody) {
    return this.connectionsService.findOne(id, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConnectionDto: UpdateConnectionDto, @Body() user: UserFromBody) {
    return this.connectionsService.update(id, updateConnectionDto, user.userId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @Body() user: UserFromBody) {
    return this.connectionsService.remove(id, user.userId);
  }
}
