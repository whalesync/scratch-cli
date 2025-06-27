import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SnapshotId } from 'src/types/ids';
import { ScratchpadAuthGuard } from '../auth/scratchpad-auth.guard';
import { RequestWithUser } from '../auth/types';
import { SnapshotRecord } from '../remote-service/connectors/types';
import { BulkUpdateRecordsDto } from './dto/bulk-update-records.dto';
import { CreateSnapshotDto } from './dto/create-snapshot.dto';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { Snapshot } from './entities/snapshot.entity';
import { SnapshotService } from './snapshot.service';

@Controller('snapshot')
export class SnapshotController {
  constructor(private readonly service: SnapshotService) {}

  @UseGuards(ScratchpadAuthGuard)
  @Post()
  async create(@Body() createSnapshotDto: CreateSnapshotDto, @Req() req: RequestWithUser): Promise<Snapshot> {
    return new Snapshot(await this.service.create(createSnapshotDto, req.user.id));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get()
  async findAll(
    @Query('connectorAccountId') connectorAccountId: string,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot[]> {
    return (await this.service.findAll(connectorAccountId, req.user.id)).map((s) => new Snapshot(s));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id')
  async findOne(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<Snapshot | null> {
    const snapshot = await this.service.findOne(id, req.user.id);
    if (!snapshot) {
      return null;
    }
    return new Snapshot(snapshot);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: SnapshotId,
    @Body() updateSnapshotDto: UpdateSnapshotDto,
    @Req() req: RequestWithUser,
  ): Promise<Snapshot> {
    return new Snapshot(await this.service.update(id, updateSnapshotDto, req.user.id));
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/publish')
  async publish(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<void> {
    return this.service.publish(id, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/download')
  async download(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<void> {
    return this.service.download(id, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: SnapshotId, @Req() req: RequestWithUser): Promise<void> {
    await this.service.delete(id, req.user.id);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Get(':id/tables/:tableId/records')
  async listRecords(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Query('cursor') cursor: string | undefined,
    @Query('take', new ParseIntPipe({ optional: true })) take = 100,
    @Req() req: RequestWithUser,
  ): Promise<{ records: SnapshotRecord[]; nextCursor?: string }> {
    return this.service.listRecords(snapshotId, tableId, req.user.id, cursor, take);
  }

  @UseGuards(ScratchpadAuthGuard)
  @Post(':id/tables/:tableId/records/bulk')
  @HttpCode(204)
  async bulkUpdateRecords(
    @Param('id') snapshotId: SnapshotId,
    @Param('tableId') tableId: string,
    @Body() bulkUpdateRecordsDto: BulkUpdateRecordsDto,
    @Req() req: RequestWithUser,
  ): Promise<void> {
    await this.service.bulkUpdateRecords(snapshotId, tableId, bulkUpdateRecordsDto, req.user.id);
  }
}
