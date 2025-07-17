import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { UpsertViewDto } from './dto/upsert-view.dto';
import { ColumnView } from './entities/column-view.entity';
import { ViewService } from './view.service';

@Controller('views')
export class ViewController {
  constructor(private readonly viewService: ViewService) {}

  @Post()
  async upsertView(@Body() dto: UpsertViewDto): Promise<ColumnView> {
    return this.viewService.upsertView(dto);
  }

  @Put(':id')
  async updateView(@Param('id') id: string, @Body() dto: UpsertViewDto): Promise<ColumnView> {
    // For PUT, we'll use the same upsert logic but ensure the id matches
    const updatedDto = { ...dto, id };
    return this.viewService.upsertView(updatedDto);
  }

  @Get(':id')
  async getView(@Param('id') id: string): Promise<ColumnView | null> {
    return this.viewService.getView(id);
  }

  @Get('snapshot/:snapshotId')
  async getViewsBySnapshot(@Param('snapshotId') snapshotId: string): Promise<ColumnView[]> {
    return this.viewService.getViewsBySnapshot(snapshotId);
  }

  @Delete(':id')
  async deleteView(@Param('id') id: string): Promise<void> {
    return this.viewService.deleteView(id);
  }
}
