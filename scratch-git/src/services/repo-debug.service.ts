import git from 'isomorphic-git';
import fs from 'node:fs';
import { BaseRepoService } from './base-repo.service';

export class RepoDebugService extends BaseRepoService {
  async getLog(ref: string, depth: number = 10): Promise<Array<{ oid: string; parent: string[] }>> {
    const dir = this.getRepoPath();
    try {
      const commits = await git.log({ fs, dir, gitdir: dir, ref, depth });
      return commits.map((c) => ({ oid: c.oid, parent: c.commit.parent }));
    } catch {
      return [];
    }
  }

  async getGraphData(): Promise<{
    commits: Array<{
      oid: string;
      message: string;
      parents: string[];
      timestamp: number;
      author: { name: string; email: string };
    }>;
    refs: Array<{ name: string; oid: string; type: 'branch' | 'tag' }>;
  }> {
    const dir = this.getRepoPath();

    // Helper to peel tags to commits
    const resolveToCommit = async (oid: string): Promise<string> => {
      try {
        const type = await git.readObject({ fs, dir, gitdir: dir, oid }).then((r) => r.type);
        if (type === 'tag') {
          const { tag } = await git.readTag({ fs, dir, gitdir: dir, oid });
          return resolveToCommit(tag.object);
        }
        return oid;
      } catch {
        return oid;
      }
    };

    // Get all refs (branches and tags)
    const refs: Array<{ name: string; oid: string; type: 'branch' | 'tag' }> = [];

    // listBranches returns names of local branches
    try {
      const branches = await git.listBranches({ fs, dir, gitdir: dir });
      for (const branch of branches) {
        const oid = await git.resolveRef({ fs, dir, gitdir: dir, ref: branch });
        const commitOid = await resolveToCommit(oid);
        refs.push({ name: branch, oid: commitOid, type: 'branch' });
      }
    } catch {
      // ignore
    }

    // listTags returns names of tags
    try {
      const tags = await git.listTags({ fs, dir, gitdir: dir });
      for (const tag of tags) {
        const oid = await git.resolveRef({ fs, dir, gitdir: dir, ref: tag });
        const commitOid = await resolveToCommit(oid);
        refs.push({ name: tag, oid: commitOid, type: 'tag' });
      }
    } catch {
      // ignore
    }

    // Collect all unique OIDs from refs to fetch history from
    const uniqueHeads = new Set(refs.map((r) => r.oid));

    // Fallback if no refs found
    if (refs.length === 0) {
      try {
        const mainOid = await git.resolveRef({ fs, dir, gitdir: dir, ref: 'main' });
        const commitOid = await resolveToCommit(mainOid);
        refs.push({ name: 'main', oid: commitOid, type: 'branch' });
        uniqueHeads.add(commitOid);
      } catch {
        // ignore
      }
    }

    const commitsMap = new Map<
      string,
      {
        oid: string;
        message: string;
        parents: string[];
        timestamp: number;
        author: { name: string; email: string };
      }
    >();

    const fetchLog = async (ref: string) => {
      try {
        const requestLog = await git.log({
          fs,
          dir,
          gitdir: dir,
          ref,
          depth: 50, // Limit depth per branch
        });
        for (const c of requestLog) {
          if (!commitsMap.has(c.oid)) {
            commitsMap.set(c.oid, {
              oid: c.oid,
              message: c.commit.message,
              parents: c.commit.parent,
              timestamp: c.commit.author.timestamp,
              author: {
                name: c.commit.author.name,
                email: c.commit.author.email,
              },
            });
          }
        }
      } catch {
        // console.error(`Failed to fetch log for ref ${ref}:`, e);
      }
    };

    // Fetch log for each unique head
    // git.log needs a ref or OID.
    for (const oid of uniqueHeads) {
      await fetchLog(oid);
    }

    // Edge case: if we have dirty branch but it points to same commit as main,
    // uniqueHeads will effectively just be main's OID. That is fine, we get the commits.
    // The refs array will still allow UI to show both labels on that commit.

    // Sort by timestamp desc
    const sortedCommits = Array.from(commitsMap.values()).sort((a, b) => b.timestamp - a.timestamp);

    return { commits: sortedCommits, refs };
  }
}
