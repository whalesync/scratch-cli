import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class PipelineAdminService {
  constructor(private readonly db: DbService) {}

  async listPipelines(workbookId: string, connectorAccountId?: string) {
    return await this.db.client.publishPlan.findMany({
      where: {
        workbookId,
        connectorAccountId: connectorAccountId || undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        _count: {
          select: { entries: true },
        },
      },
    });
  }

  async listFileIndex(workbookId: string) {
    return await this.db.client.fileIndex.findMany({
      where: { workbookId },
      orderBy: [{ folderPath: 'asc' }, { filename: 'asc' }],
    });
  }

  async listRefIndex(workbookId: string) {
    return await this.db.client.fileReference.findMany({
      where: { workbookId },
      orderBy: [{ sourceFilePath: 'asc' }, { targetFolderPath: 'asc' }],
    });
  }

  async listPipelineEntries(pipelineId: string) {
    return await this.db.client.publishPlanEntry.findMany({
      where: { planId: pipelineId },
      orderBy: [{ phase: 'asc' }, { filePath: 'asc' }],
    });
  }

  async deletePipeline(pipelineId: string) {
    return await this.db.client.publishPlan.delete({
      where: { id: pipelineId },
    });
  }
}
