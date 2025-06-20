import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { AppService } from './app.service';

interface Record {
  id: string;
  remote: { title: string };
  staged: { title: string } | null | undefined;
  suggested: { title: string } | null | undefined;
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): string {
    return '🌪️🐋🌀🐳💫🐋🎡🐳🌊🐋⚡🐳🔄🐋🌟';
  }

  @Get('health')
  healthCheck(): string {
    return 'OK';
  }

  // TODO: Move all the record stuff into its own controller+module.

  @Get('records')
  getRecords(): Record[] {
    return this.appService.getRecords();
  }

  @Post('records')
  createRecord(@Body() record: { title: string }): Record {
    return this.appService.createRecord(record);
  }

  @Put('records/:id')
  updateRecord(@Param('id') id: string, @Body() body: { stage: boolean; data: { title: string } }): Record {
    return this.appService.updateRecord(id, body.stage, body.data);
  }

  @Delete('records/:id')
  @HttpCode(204)
  deleteRecord(@Param('id') id: string, @Body() body: { stage: boolean }): void {
    return this.appService.deleteRecord(id, body.stage);
  }

  @Post('records/push')
  @HttpCode(204)
  pushChanges(): void {
    return this.appService.pushChanges();
  }
}
