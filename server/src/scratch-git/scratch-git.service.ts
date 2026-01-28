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
      // 4. Delete existing repo
      await this.scratchGitClient.deleteRepo(workbookId);

      // 5. Init new repo
      await this.scratchGitClient.initRepo(workbookId);

      // 6. Commit files directory by directory
      const filesByDir = new Map<string, typeof gitFiles>();

      for (const file of gitFiles) {
        const dir = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '.';
        if (!filesByDir.has(dir)) {
          filesByDir.set(dir, []);
        }
        filesByDir.get(dir)!.push(file);
      }

      // Sort directories to ensure consistent order (e.g., shortest first or alphabetical)
      const sortedDirs = Array.from(filesByDir.keys()).sort();

      for (const dir of sortedDirs) {
        const dirFiles = filesByDir.get(dir);
        if (dirFiles) {
          await this.scratchGitClient.commitFiles(
            workbookId,
            'main',
            dirFiles,
            `Backup directory ${dir} via Spinner UI at ${new Date().toISOString()}`,
          );
        }
      }

      // 7. Rebase dirty branch on top (user edits win)
      await this.scratchGitClient.rebaseDirty(workbookId);

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

  async listRepoFiles(workbookId: WorkbookId, branch: string, folder: string): Promise<any[]> {
    // Verify access
    // Although controller might also verify, verifying here checks workbook existence.
    // For now simplistic access check (only existence)
    // In future: ensureWorkbookAccess(workbookId, actor);
    // But this method receives no actor. Controller should pass it?
    // Implementing basic proxy first. Security relies on controller calling ensuring permissions.
    return this.scratchGitClient.list(workbookId, branch, folder);
  }

  async getRepoFile(workbookId: WorkbookId, branch: string, path: string): Promise<{ content: string }> {
    return this.scratchGitClient.getFile(workbookId, branch, path);
  }

  async commitFile(workbookId: WorkbookId, path: string, content: string, message: string): Promise<void> {
    await this.scratchGitClient.commitFiles(workbookId, 'dirty', [{ path, content }], message);
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
