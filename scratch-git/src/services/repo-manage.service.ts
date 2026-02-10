import git from 'isomorphic-git';
import fs from 'node:fs';
import path from 'node:path';
import { DIRTY_BRANCH, MAIN_BRANCH } from '../../lib/constants';
import { BaseRepoService } from './base-repo.service';

const DEFAULT_AUTHOR = { name: 'Scratch', email: 'scratch@example.com' };

export class RepoManageService extends BaseRepoService {
  async initRepo(): Promise<void> {
    const dir = this.getRepoPath();
    console.log(`[RepoManageService] Initializing repo "${this.repoId}" at ${dir}`);
    await fs.promises.mkdir(dir, { recursive: true });

    // Check if HEAD exists (bare repo structure)
    if (!fs.existsSync(path.join(dir, 'HEAD'))) {
      await git.init({
        fs,
        dir,
        gitdir: dir,
        defaultBranch: MAIN_BRANCH,
        bare: true,
      });
    }

    // Create initial commit if empty
    try {
      await this.resolveRef(MAIN_BRANCH);
    } catch {
      // Create empty initial commit
      const emptyTreeOid = await git.writeTree({
        fs,
        dir,
        gitdir: dir,
        tree: [],
      });
      const commitOid = await git.writeCommit({
        fs,
        dir,
        gitdir: dir,
        commit: {
          tree: emptyTreeOid,
          parent: [],
          author: {
            ...DEFAULT_AUTHOR,
            timestamp: Math.floor(Date.now() / 1000),
            timezoneOffset: 0,
          },
          committer: {
            ...DEFAULT_AUTHOR,
            timestamp: Math.floor(Date.now() / 1000),
            timezoneOffset: 0,
          },
          message: 'Initial commit',
        },
      });
      // Point main to this commit
      await this.forceRef(MAIN_BRANCH, commitOid);

      // Ensure dirty branch exists and points to main
      await git.branch({
        fs,
        dir,
        gitdir: dir,
        ref: DIRTY_BRANCH,
        object: commitOid,
        checkout: false,
      });
    }
  }

  async deleteRepo(): Promise<void> {
    const dir = this.getRepoPath();
    if (fs.existsSync(dir)) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  }

  async resetToMain(): Promise<void> {
    // Resolve main commit
    const mainOid = await this.resolveRef(MAIN_BRANCH);

    // Force dirty to point to main
    await this.forceRef(DIRTY_BRANCH, mainOid);
  }
}
