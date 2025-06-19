import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  Post,
  Delete,
} from '@nestjs/common';
import { AppService } from './app.service';

interface Record {
  id: string;
  title: string;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('records')
  getRecords(): Record[] {
    return this.appService.getRecords();
  }

  @Put('records/:id')
  updateRecord(@Param('id') id: string, @Body() record: Record): Record {
    return this.appService.updateRecord(id, record);
  }

  @Put('records/batch')
  updateRecordsBatch(
    @Body() updates: { id: string; title: string }[],
  ): Record[] {
    return this.appService.updateRecordsBatch(updates);
  }

  @Post('records')
  createRecord(@Body() record: Omit<Record, 'id'>): Record {
    return this.appService.createRecord(record);
  }

  @Post('records/batch')
  createRecordsBatch(@Body() records: Omit<Record, 'id'>[]): Record[] {
    return this.appService.createRecordsBatch(records);
  }

  @Delete('records/:id')
  deleteRecord(@Param('id') id: string): void {
    return this.appService.deleteRecord(id);
  }

  @Delete('records/batch')
  deleteRecordsBatch(@Body() ids: string[]): void {
    return this.appService.deleteRecordsBatch(ids);
  }
}
