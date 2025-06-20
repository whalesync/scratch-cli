import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
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
  createRecord(
    @Body() data: Record<string, unknown> | Record<string, unknown>[],
  ): DataRecord | DataRecord[] {
    if (Array.isArray(data)) {
      return this.appService.createRecords(data);
    }
    return this.appService.createRecord(data);
  }

  @Post('import')
  importRecords(@Body() records: Record<string, unknown>[]): DataRecord[] {
    if (!Array.isArray(records)) {
      throw new BadRequestException('Request body must be an array of records.');
    }
    return this.appService.importRecords(records);
  }

  @Put('records/:id')
  updateRecord(@Param('id') id: string, @Body() body: { stage: boolean; data: Record<string, unknown> }): DataRecord {
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
