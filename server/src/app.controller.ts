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
  remote: { title: string };
  staged: { title: string };
  suggested: { title: string | null };
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  healthCheck(): string {
    return 'OK';
  }

  @Get('records')
  getRecords(): Record[] {
    return this.appService.getRecords();
  }

  @Post('records/batch')
  createRecords(@Body() records: { title: string }[]): Record[] {
    return this.appService.createRecordsBatch(records);
  }

  @Put('records/batch')
  updateRecords(@Body() updates: { id: string; title: string }[]): Record[] {
    return this.appService.updateRecordsBatch(updates);
  }

  @Delete('records/batch')
  deleteRecords(@Body() ids: string[]): void {
    return this.appService.deleteRecordsBatch(ids);
  }

  @Post('records')
  createRecord(@Body() record: { title: string }): Record {
    return this.appService.createRecord(record);
  }

  @Put('records/:id')
  updateRecord(
    @Param('id') id: string,
    @Body() body: { staged: boolean; data: { title: string } },
  ): Record {
    return this.appService.updateRecord(id, body.staged, body.data);
  }

  @Delete('records/:id')
  deleteRecord(@Param('id') id: string): void {
    return this.appService.deleteRecord(id);
  }
}
