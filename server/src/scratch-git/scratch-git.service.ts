import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkbookId } from '@spinner/shared-types';
import { DbService } from 'src/db/db.service';
import { WSLogger } from 'src/logger';
import { Actor } from 'src/users/types';
import { WorkbookDbService } from '../workbook/workbook-db.service';
import { ScratchGitClient } from './scratch-git.client';

@Injectable()
export class ScratchGitService {
  constructor(
    private readonly db: DbService,
    private readonly workbookDbService: WorkbookDbService,
    private readonly scratchGitClient: ScratchGitClient,
  ) {}

  async backupWorkbookToRepo(workbookId: WorkbookId, actor: Actor): Promise<{ success: boolean; message: string }> {
    // 1. Verify permissions
    await this.ensureWorkbookAccess(workbookId, actor);

    // 2. Fetch all files
    const files = await this.workbookDbService.workbookDb.listAllFiles(workbookId);

    // 3. Prepare payload for scratch-git
    const gitFiles = files.map((f) => ({
      path: f.path.startsWith('/') ? f.path.slice(1) : f.path,
      content: f.content || '',
    }));

    if (gitFiles.length === 0) {
      return { success: true, message: 'No files to backup' };
    }

    try {
      await this.scratchGitClient.createRepo(workbookId);
      await this.scratchGitClient.commit(workbookId, gitFiles, `Backup via Spinner UI at ${new Date().toISOString()}`, {
        name: 'Spinner User',
        email: 'user@spinner.app',
      });
      await this.scratchGitClient.branchDirty(workbookId, actor.userId);

      return { success: true, message: 'Backup successful' };
    } catch (error) {
      WSLogger.error({
        source: 'ScratchGitService.backupWorkbookToRepo',
        message: 'Failed to backup workbook',
        error,
        workbookId,
      });
      throw new Error(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async ensureWorkbookAccess(id: WorkbookId, actor: Actor): Promise<void> {
    const workbook = await this.db.client.workbook.findFirst({
      where: { id, organizationId: actor.organizationId },
    });

    if (!workbook) {
      throw new NotFoundException('Workbook not found');
    }
  }
}
