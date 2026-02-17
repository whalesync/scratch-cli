/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { BullEnqueuerService } from '../worker-enqueuer/bull-enqueuer.service';
import { PipelineInfo, PipelinePhase } from './types';

@Injectable()
export class PipelineRunService {
  constructor(
    private readonly db: DbService,
    private readonly bullEnqueuerService: BullEnqueuerService,
  ) {}

  async runPipeline(pipelineId: string): Promise<PipelineInfo> {
    const pipeline = await this.db.client.publishPipeline.findUnique({ where: { id: pipelineId } });
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }

    if (pipeline.status !== 'ready') {
      throw new Error(`Pipeline is not ready (status: ${pipeline.status})`);
    }

    await this.db.client.publishPipeline.update({
      where: { id: pipelineId },
      data: { status: 'running' },
    });

    try {
      // --- Phase 1: Edit ---
      const editEntries = await (this.db.client as any).publishPipelineEntry.findMany({
        where: { pipelineId, hasEdit: true },
      });
      // console.log(`[Run] Executing Edit Phase: ${editEntries.length} entries`);
      for (const entry of editEntries) {
        await this.stubDispatch('edit', entry);
        await (this.db.client as any).publishPipelineEntry.update({
          where: { id: entry.id },
          data: { editStatus: 'success' },
        });
      }

      // --- Phase 2: Create ---
      const createEntries = await (this.db.client as any).publishPipelineEntry.findMany({
        where: { pipelineId, hasCreate: true },
      });
      // console.log(`[Run] Executing Create Phase: ${createEntries.length} entries`);
      for (const entry of createEntries) {
        await this.stubDispatch('create', entry);
        await (this.db.client as any).publishPipelineEntry.update({
          where: { id: entry.id },
          data: { createStatus: 'success' },
        });
      }

      // --- Phase 3: Delete ---
      const deleteEntries = await (this.db.client as any).publishPipelineEntry.findMany({
        where: { pipelineId, hasDelete: true },
      });
      // console.log(`[Run] Executing Delete Phase: ${deleteEntries.length} entries`);
      for (const entry of deleteEntries) {
        await this.stubDispatch('delete', entry);
        await (this.db.client as any).publishPipelineEntry.update({
          where: { id: entry.id },
          data: { deleteStatus: 'success' },
        });
      }

      // --- Phase 4: Backfill ---
      const backfillEntries = await (this.db.client as any).publishPipelineEntry.findMany({
        where: { pipelineId, hasBackfill: true },
      });
      // console.log(`[Run] Executing Backfill Phase: ${backfillEntries.length} entries`);
      for (const entry of backfillEntries) {
        await this.stubDispatch('backfill', entry);
        await (this.db.client as any).publishPipelineEntry.update({
          where: { id: entry.id },
          data: { backfillStatus: 'success' },
        });
      }

      await this.db.client.publishPipeline.update({
        where: { id: pipelineId },
        data: { status: 'completed' },
      });

      return {
        pipelineId: pipeline.id,
        workbookId: pipeline.workbookId,
        userId: pipeline.userId,
        phases: pipeline.phases as never as PipelinePhase[],
        branchName: pipeline.branchName,
        createdAt: pipeline.createdAt,
        status: 'completed',
      };
    } catch (err) {
      console.error('Pipeline failed', err);
      await this.db.client.publishPipeline.update({
        where: { id: pipelineId },
        data: { status: 'failed' },
      });
      throw err;
    }
  }

  private async stubDispatch(phase: string, entry: any) {
    // Stub for connector dispatch
    // In real implementation, this would look up the connector for entry.filePath
    // and call the appropriate method.
    // console.log(`[Dispatch] ${phase} on ${entry.filePath}`);
    try {
      await new Promise((resolve) => setTimeout(resolve, 10)); // Simulate async work
    } catch (e) {
      // ignore
    }
  }
}
