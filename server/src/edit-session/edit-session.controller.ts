import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { EditSessionId } from 'src/types/ids';
import { FAKE_GLOBAL_USER_ID } from '../db/fake_user';
import { CreateEditSessionDto } from './dto/create-edit-session.dto';
import { UpdateEditSessionDto } from './dto/update-edit-session.dto';
import { EditSessionService } from './edit-session.service';
import { EditSession } from './entities/edit-session.entity';

@Controller('edit-sessions')
// TODO: Apply auth guard and plumb real user.
// @UseGuards(ScratchpadAuthGuard)
export class EditSessionController {
  constructor(private readonly editSessionService: EditSessionService) {}

  @Post()
  async create(@Body() createEditSessionDto: CreateEditSessionDto): Promise<EditSession> {
    return this.editSessionService.create(createEditSessionDto, FAKE_GLOBAL_USER_ID);
  }

  @Get()
  async findAll(@Query('connectorAccountId') connectorAccountId: string): Promise<EditSession[]> {
    return this.editSessionService.findAll(connectorAccountId, FAKE_GLOBAL_USER_ID);
  }

  @Get(':id')
  async findOne(@Param('id') id: EditSessionId): Promise<EditSession | null> {
    return this.editSessionService.findOne(id, FAKE_GLOBAL_USER_ID);
  }

  @Patch(':id')
  async update(
    @Param('id') id: EditSessionId,
    @Body() updateEditSessionDto: UpdateEditSessionDto,
  ): Promise<EditSession> {
    return await this.editSessionService.update(id, updateEditSessionDto, FAKE_GLOBAL_USER_ID);
  }
}
