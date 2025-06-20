import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { ScratchpadAuthGuard } from './auth/scratchpad-auth.guard';

interface DataRecord {
  id: string;
  remote: Record<string, unknown>;
  staged: Record<string, unknown> | null | undefined;
  suggested: Record<string, unknown> | null | undefined;
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

  @Get('example/secured')
  @UseGuards(ScratchpadAuthGuard)
  exampleSecuredEndpoint(): string {
    return 'OK - Secured!';
  }

  // TODO: Move all the record stuff into its own controller+module.

  @Get('records')
  getRecords(): DataRecord[] {
    return this.appService.getRecords();
  }

  @Post('records')
  createRecord(@Body() record: Record<string, unknown>): DataRecord {
    return this.appService.createRecord(record);
  }

  @Put('records/:id')
<<<<<<< HEAD
  updateRecord(@Param('id') id: string, @Body() body: { stage: boolean; data: { title: string } }): Record {
=======
  updateRecord(
    @Param('id') id: string,
    @Body() body: { stage: boolean; data: Record<string, unknown> },
  ): DataRecord {
>>>>>>> 1ac52b9 (multiple columns)
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
