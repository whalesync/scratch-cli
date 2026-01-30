import { Injectable } from '@nestjs/common';
import { WorkbookId } from '@spinner/shared-types';
import { ScratchGitClient } from './scratch-git.client';

// The object returned by listRepoFiles
export interface RepoFileRef {
  name: string;
  path: string;
  type: 'file' | 'folder';
}

export const MAIN_BRANCH = 'main';
export const DIRTY_BRANCH = 'dirty';

@Injectable()
export class ScratchGitService {
  constructor(private readonly scratchGitClient: ScratchGitClient) {}

  async initRepo(workbookId: WorkbookId): Promise<void> {
    await this.scratchGitClient.initRepo(workbookId);
  }

  async deleteRepo(workbookId: WorkbookId): Promise<void> {
    await this.scratchGitClient.deleteRepo(workbookId);
  }

  async rebaseDirty(workbookId: WorkbookId) {
    await this.scratchGitClient.rebaseDirty(workbookId);
  }

  async commitFilesToBranch(
    workbookId: WorkbookId,
    branch: string,
    files: { path: string; content: string }[],
    message: string,
  ) {
    await this.commitFilesBatch(workbookId, branch, files, message);
  }

  private async commitFilesBatch(
    workbookId: WorkbookId,
    branch: string,
    files: { path: string; content: string }[],
    message: string,
  ) {
    const filesByDir = new Map<string, typeof files>();

    for (const file of files) {
      const dir = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '.';
      if (!filesByDir.has(dir)) {
        filesByDir.set(dir, []);
      }
      filesByDir.get(dir)!.push(file);
    }

    const sortedDirs = Array.from(filesByDir.keys()).sort();

    for (const dir of sortedDirs) {
      const dirFiles = filesByDir.get(dir);
      if (dirFiles) {
        await this.scratchGitClient.commitFiles(workbookId, branch, dirFiles, message);
      }
    }
  }

  async listRepoFiles(workbookId: WorkbookId, branch: string, folder: string): Promise<any[]> {
    return this.scratchGitClient.list(workbookId, branch, folder);
  }

  async getRepoFile(workbookId: WorkbookId, branch: string, path: string): Promise<{ content: string }> {
    return this.scratchGitClient.getFile(workbookId, branch, path);
  }

  async commitFile(workbookId: WorkbookId, path: string, content: string, message: string): Promise<void> {
    await this.scratchGitClient.commitFiles(workbookId, 'dirty', [{ path, content }], message);
  }

  async deleteFile(workbookId: WorkbookId, path: string, message: string): Promise<void> {
    await this.scratchGitClient.deleteFiles(workbookId, 'dirty', [path], message);
  }

  async publishFile(workbookId: WorkbookId, path: string, content: string, message: string): Promise<void> {
    await this.scratchGitClient.publishFile(workbookId, { path, content }, message);
  }

  async getRepoStatus(workbookId: WorkbookId): Promise<any> {
    return this.scratchGitClient.getStatus(workbookId);
  }

  async getFileDiff(workbookId: WorkbookId, path: string): Promise<any> {
    return this.scratchGitClient.getDiff(workbookId, path);
  }

  async getFolderDiff(
    workbookId: WorkbookId,
    folderPath: string,
  ): Promise<Array<{ path: string; status: 'added' | 'modified' | 'deleted' }>> {
    return this.scratchGitClient.getFolderDiff(workbookId, folderPath);
  }

  async getGraph(workbookId: WorkbookId): Promise<any> {
    return this.scratchGitClient.getGraph(workbookId);
  }
}
