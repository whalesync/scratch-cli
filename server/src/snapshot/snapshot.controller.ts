import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { SnapshotId } from 'src/types/ids';
import { FAKE_GLOBAL_USER_ID } from '../db/fake_user';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { Snapshot } from './entities/snapshot.entity';
import { SnapshotService } from './snapshot.service';

@Controller('snapshot')
// TODO: Apply auth guard and plumb real user.
// @UseGuards(ScratchpadAuthGuard)
export class SnapshotController {
  constructor(private readonly service: SnapshotService) {}

  @Post()
  async create(@Body() createSnapshotDto: CreateSnapshotDto): Promise<Snapshot> {
    return this.service.create(createSnapshotDto, FAKE_GLOBAL_USER_ID);
  }

  @Get()
  async findAll(@Query('connectorAccountId') connectorAccountId: string): Promise<Snapshot[]> {
    return this.service.findAll(connectorAccountId, FAKE_GLOBAL_USER_ID);
  }

  @Get(':id')
  async findOne(@Param('id') id: SnapshotId): Promise<Snapshot | null> {
    return this.service.findOne(id, FAKE_GLOBAL_USER_ID);
  }

  @Patch(':id')
  async update(@Param('id') id: SnapshotId, @Body() updateSnapshotDto: UpdateSnapshotDto): Promise<Snapshot> {
    return this.service.update(id, updateSnapshotDto, FAKE_GLOBAL_USER_ID);
  }
}
