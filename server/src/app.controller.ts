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

  @Post('records')
  createRecords(@Body() records: Omit<Record, 'id'>[]): Record[] {
    return this.appService.createRecordsBatch(records);
  }

  @Put('records')
  updateRecords(@Body() updates: { id: string; title: string }[]): Record[] {
    return this.appService.updateRecordsBatch(updates);
  }

  @Delete('records')
  deleteRecords(@Body() ids: string[]): void {
    return this.appService.deleteRecordsBatch(ids);
  }

  @Post('records')
  createRecord(@Body() record: Omit<Record, 'id'>): Record {
    return this.appService.createRecord(record);
  }

  @Put('records/:id')
  updateRecord(@Param('id') id: string, @Body() record: Record): Record {
    return this.appService.updateRecord(id, record);
  }

  @Delete('records/:id')
  deleteRecord(@Param('id') id: string): void {
    return this.appService.deleteRecord(id);
  }
}
