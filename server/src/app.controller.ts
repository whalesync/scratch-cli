import { Controller, Get, Put, Body, Param } from '@nestjs/common';
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
}
