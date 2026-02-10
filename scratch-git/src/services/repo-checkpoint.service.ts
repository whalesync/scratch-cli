import git from 'isomorphic-git';
import fs from 'node:fs';
import { DIRTY_BRANCH, MAIN_BRANCH } from '../../lib/constants';
import { BaseRepoService } from './base-repo.service';

export class RepoCheckpointService extends BaseRepoService {
  async createCheckpoint(name: string): Promise<void> {
    const dir = this.getRepoPath();

    // Resolve current commits
    const mainCommit = await this.resolveRef(MAIN_BRANCH);
    // Dirty might not exist, ensure it does or resolve main
    let dirtyCommit = mainCommit;
    try {
      dirtyCommit = await this.resolveRef(DIRTY_BRANCH);
    } catch {
      // ignore
    }

    // Create tags
    await git.tag({
      fs,
      dir,
      gitdir: dir,
      ref: `main_${name}`,
      object: mainCommit,
    });
    await git.tag({
      fs,
      dir,
      gitdir: dir,
      ref: `dirty_${name}`,
      object: dirtyCommit,
    });
  }

  async revertToCheckpoint(name: string): Promise<void> {
    try {
      const mainTag = await this.resolveRef(`main_${name}`);
      const dirtyTag = await this.resolveRef(`dirty_${name}`);

      await this.forceRef(MAIN_BRANCH, mainTag);
      await this.forceRef(DIRTY_BRANCH, dirtyTag);
    } catch {
      throw new Error(`Checkpoint ${name} not found or incomplete`);
    }
  }

  async listCheckpoints(): Promise<{ name: string; timestamp: number; message: string }[]> {
    const dir = this.getRepoPath();
    const tags = await git.listTags({ fs, dir, gitdir: dir });
    const mainTags = tags.filter((t) => t.startsWith('main_')).map((t) => t.slice(5));
    const dirtyTags = new Set(tags.filter((t) => t.startsWith('dirty_')).map((t) => t.slice(6)));

    // Checkpoints exist where both main_ and dirty_ tags exist
    const checkpointNames = mainTags.filter((name) => dirtyTags.has(name));

    const results = await Promise.all(
      checkpointNames.map(async (name) => {
        try {
          const oid = await this.resolveRef(`dirty_${name}`);
          const { commit } = await git.readCommit({ fs, dir, gitdir: dir, oid });
          return {
            name,
            timestamp: commit.committer.timestamp,
            message: commit.message,
          };
        } catch {
          return null;
        }
      }),
    );

    return results.filter((r): r is { name: string; timestamp: number; message: string } => r !== null);
  }

  async deleteCheckpoint(name: string): Promise<void> {
    const dir = this.getRepoPath();
    try {
      await git.deleteTag({ fs, dir, gitdir: dir, ref: `main_${name}` });
    } catch {
      // ignore
    }
    try {
      await git.deleteTag({ fs, dir, gitdir: dir, ref: `dirty_${name}` });
    } catch {
      // ignore
    }
  }
}
