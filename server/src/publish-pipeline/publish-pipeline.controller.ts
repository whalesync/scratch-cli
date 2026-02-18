import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { WorkbookId } from '@spinner/shared-types';
import { ScratchAuthGuard } from '../auth/scratch-auth.guard';
import type { RequestWithUser } from '../auth/types';
import { PlanPublishV2Dto, RunPublishV2Dto } from './dto/publish-v2.dto';
import { PipelineAdminService } from './pipeline-admin.service';
import { PipelineBuildService } from './pipeline-build.service';
import { PipelineRunService } from './pipeline-run.service';

@Controller('workbook/:workbookId/publish-v2')
@UseGuards(ScratchAuthGuard)
export class PublishPipelineController {
  constructor(
    private readonly pipelineBuildService: PipelineBuildService,
    private readonly pipelineRunService: PipelineRunService,
    private readonly pipelineAdminService: PipelineAdminService,
  ) {}

  @Post('plan')
  async plan(@Param('workbookId') workbookId: WorkbookId, @Body() body: PlanPublishV2Dto, @Req() req: RequestWithUser) {
    // For now taking userId from body, but should probably match req.user or check permissions
    // Using req.user.id for security context
    return this.pipelineBuildService.buildPipeline(workbookId, req.user.id, body.connectorAccountId);
  }

  @Post('run')
  async run(@Param('workbookId') workbookId: WorkbookId, @Body() body: RunPublishV2Dto) {
    return this.pipelineRunService.runPipeline(body.pipelineId, body.phase);
  }

  @Get()
  async list(@Param('workbookId') workbookId: WorkbookId, @Query('connectorAccountId') connectorAccountId?: string) {
    return this.pipelineAdminService.listPipelines(workbookId, connectorAccountId);
  }

  @Get(':pipelineId/entries')
  async entries(@Param('pipelineId') pipelineId: string) {
    return this.pipelineAdminService.listPipelineEntries(pipelineId);
  }

  @Get('index/files')
  async fileIndex(@Param('workbookId') workbookId: WorkbookId) {
    return this.pipelineAdminService.listFileIndex(workbookId);
  }

  @Get('index/refs')
  async refIndex(@Param('workbookId') workbookId: WorkbookId) {
    return this.pipelineAdminService.listRefIndex(workbookId);
  }

  @Delete(':pipelineId')
  async delete(@Param('pipelineId') pipelineId: string) {
    return this.pipelineAdminService.deletePipeline(pipelineId);
  }
}
