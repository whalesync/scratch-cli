import { DIRTY_BRANCH, MAIN_BRANCH } from '../../lib/constants';
import { DirtyFile } from '../../lib/types';
import { BaseRepoService } from './base-repo.service';

export class RepoDiffService extends BaseRepoService {
  async getDirtyStatus(): Promise<DirtyFile[]> {
    try {
      const [mainCommit, dirtyCommit] = await Promise.all([
        this.resolveRef(MAIN_BRANCH),
        this.resolveRef(DIRTY_BRANCH),
      ]);
      if (mainCommit === dirtyCommit) return [];
      return this.compareCommits(mainCommit, dirtyCommit);
    } catch {
      return [];
    }
  }

  async getFolderDirtyStatus(folderPath: string): Promise<DirtyFile[]> {
    const folder = folderPath.startsWith('/') ? folderPath.slice(1) : folderPath;
    try {
      const [mainCommit, dirtyCommit] = await Promise.all([
        this.resolveRef(MAIN_BRANCH),
        this.resolveRef(DIRTY_BRANCH),
      ]);
      if (mainCommit === dirtyCommit) return [];
      const allChanges = await this.compareCommits(mainCommit, dirtyCommit);
      const prefix = folder.endsWith('/') ? folder : folder + '/';
      return allChanges.filter((f) => f.path.startsWith(prefix));
    } catch {
      return [];
    }
  }
}
