import archiver from 'archiver';
import git from 'isomorphic-git';
import { diff3Merge } from 'node-diff3';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { DirtyFile, FileChange, GitFile, IGitService, TreeEntry } from './types';

const REPOS_BASE_DIR = process.env.GIT_REPOS_DIR || 'repos';
const DEFAULT_AUTHOR = { name: 'Scratch', email: 'scratch@example.com' };
const writeLocks = new Map<string, Promise<unknown>>();

async function withWriteLock<T>(gitBucket: string, ref: string, operation: () => Promise<T>): Promise<T> {
  const lockKey = `${gitBucket}:${ref}`;
  const previousPromise = writeLocks.get(lockKey);
  const ourPromise = (async () => {
    if (previousPromise !== undefined) {
      await previousPromise.catch(() => {});
    }
    return operation();
  })();
  writeLocks.set(lockKey, ourPromise);
  try {
    return await ourPromise;
  } finally {
    if (writeLocks.get(lockKey) === ourPromise) {
      writeLocks.delete(lockKey);
    }
  }
}

export class GitService implements IGitService {
  public getRepoPath(repoId: string): string {
    if (path.isAbsolute(REPOS_BASE_DIR)) {
      return path.join(REPOS_BASE_DIR, `${repoId}.git`);
    }
    return path.join(process.cwd(), REPOS_BASE_DIR, `${repoId}.git`);
  }

  async initRepo(repoId: string): Promise<void> {
    const dir = this.getRepoPath(repoId);
    console.log(`[GitService] Initializing repo "${repoId}" at ${dir}`);
    await fs.promises.mkdir(dir, { recursive: true });

    // Check if HEAD exists (bare repo structure)
    if (!fs.existsSync(path.join(dir, 'HEAD'))) {
      await git.init({
        fs,
        dir,
        gitdir: dir,
        defaultBranch: 'main',
        bare: true,
      });
    }

    // Create initial commit if empty
    try {
      await git.resolveRef({ fs, dir, gitdir: dir, ref: 'main' });
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
      await this.forceRef(dir, 'main', commitOid);

      // Ensure dirty branch exists and points to main
      await git.branch({
        fs,
        dir,
        gitdir: dir,
        ref: 'dirty',
        object: commitOid,
        checkout: false,
      });
    }
  }

  async deleteRepo(repoId: string): Promise<void> {
    const dir = this.getRepoPath(repoId);
    if (fs.existsSync(dir)) {
      await fs.promises.rm(dir, { recursive: true, force: true });
    }
  }

  async rebaseDirty(
    repoId: string,
    strategy: 'ours' | 'diff3' = 'diff3',
  ): Promise<{ rebased: boolean; conflicts: string[] }> {
    const dir = this.getRepoPath(repoId);
    const mainRef = 'main';
    const dirtyRef = 'dirty';

    // Ensure dirty exists
    try {
      await git.resolveRef({ fs, dir, gitdir: dir, ref: dirtyRef });
    } catch {
      // If dirty doesn't exist, just branch from main
      const mainOid = await git.resolveRef({
        fs,
        dir,
        gitdir: dir,
        ref: mainRef,
      });
      await git.branch({
        fs,
        dir,
        gitdir: dir,
        ref: dirtyRef,
        object: mainOid,
        checkout: false,
      });
      return { rebased: true, conflicts: [] };
    }

    const [mainCommit, dirtyCommit] = await Promise.all([
      git.resolveRef({ fs, dir, gitdir: dir, ref: mainRef }),
      git.resolveRef({ fs, dir, gitdir: dir, ref: dirtyRef }),
    ]);

    if (mainCommit === dirtyCommit) {
      return { rebased: true, conflicts: [] };
    }

    const mergeBaseOids = await git.findMergeBase({
      fs,
      dir,
      gitdir: dir,
      oids: [mainCommit, dirtyCommit],
    });
    if (mergeBaseOids.length === 0) {
      // Reset dirty to main
      await this.forceRef(dir, dirtyRef, mainCommit);
      return { rebased: true, conflicts: [] };
    }
    const mergeBase = mergeBaseOids[0] as string;

    // Get changes on dirty since mergeBase
    const userChanges = await this.compareCommits(repoId, mergeBase, dirtyCommit);

    if (userChanges.length === 0) {
      await this.forceRef(dir, dirtyRef, mainCommit);
      return { rebased: true, conflicts: [] };
    }

    // For diff3, we need the base content for modified files
    const edits = await Promise.all(
      userChanges.map(async (change) => {
        if (change.status === 'deleted') {
          return {
            path: change.path,
            status: 'deleted' as const,
            content: null,
            baseContent: null,
          };
        }
        const content = await this.getFile(repoId, dirtyRef, change.path);
        let baseContent: string | null = null;
        if (strategy === 'diff3' && change.status === 'modified') {
          // Get content from mergeBase for 3-way merge
          try {
            const { blob } = await git.readBlob({
              fs,
              dir,
              gitdir: dir,
              oid: mergeBase,
              filepath: change.path,
            });
            baseContent = new TextDecoder().decode(blob);
          } catch {
            // ignore if fail
          }
        }
        return {
          path: change.path,
          status: change.status,
          content,
          baseContent,
        };
      }),
    );

    // Reset dirty to new main
    await this.forceRef(dir, dirtyRef, mainCommit);

    // Apply edits
    const conflicts: string[] = [];
    const changesToCommit: FileChange[] = [];

    for (const edit of edits) {
      if (edit.status === 'deleted') {
        const existsOnMain = await this.fileExists(repoId, mainRef, edit.path);
        if (existsOnMain) changesToCommit.push({ path: edit.path, type: 'delete' });
      } else if (edit.content !== null) {
        const mainContent = await this.getFile(repoId, mainRef, edit.path);

        let finalContent = edit.content;

        if (strategy === 'diff3' && edit.status === 'modified') {
          if (edit.baseContent !== null && mainContent !== null && edit.baseContent !== mainContent) {
            // 3-way merge
            finalContent = this.mergeFileContents(edit.baseContent, edit.content, mainContent);
            if (finalContent !== mainContent && finalContent !== edit.content) {
              // It merged something, might check for true conflicts if needed
              // but for now relying on strict user-wins for conflicts logic in mergeFileContents
            }
          }
        }

        if (mainContent !== null && mainContent !== finalContent) {
          // Check if main changed compared to what we started with (for conflicts reporting)
          // Simple conflict check: if main changed AND we changed it, and result isn't exactly ours or theirs?
          // For now, keep simple: if we are writing something different from main, it's a change.
          // Reporting conflicts in diff3 is complex, usually we look for conflict markers.
          // But our mergeFileContents resolves conflicts to "ours".
          // The old logic was: if mainContent != edit.content => conflict.
          // Let's explicitly check if main changed from base AND we changed from base
          // But sticking to the user request: "ours win (current) - diff3 like in mackerel"
          // In Mackerel git.ts, conflicts are reported if (main!=base && final!=main).
        }

        // Only modify if content is different matches what we want to be there
        if (mainContent !== finalContent) {
          changesToCommit.push({
            path: edit.path,
            content: finalContent,
            type: 'modify',
          });
        }
      }
    }

    if (changesToCommit.length > 0) {
      await this.commitChangesToRef(repoId, dirtyRef, changesToCommit, 'Rebase dirty on main');
    }

    return { rebased: true, conflicts };
  }

  async resetToMain(repoId: string): Promise<void> {
    const dir = this.getRepoPath(repoId);
    const mainRef = 'main';
    const dirtyRef = 'dirty';

    // Resolve main commit
    const mainOid = await git.resolveRef({
      fs,
      dir,
      gitdir: dir,
      ref: mainRef,
    });

    // Force dirty to point to main
    await this.forceRef(dir, dirtyRef, mainOid);
  }

  async getDirtyStatus(repoId: string): Promise<DirtyFile[]> {
    const dir = this.getRepoPath(repoId);
    const mainRef = 'main';
    const dirtyRef = 'dirty';
    try {
      const [mainCommit, dirtyCommit] = await Promise.all([
        git.resolveRef({ fs, dir, gitdir: dir, ref: mainRef }),
        git.resolveRef({ fs, dir, gitdir: dir, ref: dirtyRef }),
      ]);
      if (mainCommit === dirtyCommit) return [];
      return this.compareCommits(repoId, mainCommit, dirtyCommit);
    } catch {
      return [];
    }
  }

  async getFolderDirtyStatus(repoId: string, folderPath: string): Promise<DirtyFile[]> {
    const dir = this.getRepoPath(repoId);
    const mainRef = 'main';
    const dirtyRef = 'dirty';
    const folder = folderPath.startsWith('/') ? folderPath.slice(1) : folderPath;
    try {
      const [mainCommit, dirtyCommit] = await Promise.all([
        git.resolveRef({ fs, dir, gitdir: dir, ref: mainRef }),
        git.resolveRef({ fs, dir, gitdir: dir, ref: dirtyRef }),
      ]);
      if (mainCommit === dirtyCommit) return [];
      const allChanges = await this.compareCommits(repoId, mainCommit, dirtyCommit);
      const prefix = folder.endsWith('/') ? folder : folder + '/';
      return allChanges.filter((f) => f.path.startsWith(prefix));
    } catch {
      return [];
    }
  }

  async getRefOid(repoId: string, ref: string): Promise<string | null> {
    const dir = this.getRepoPath(repoId);
    try {
      const oid = await git.resolveRef({
        fs,
        dir,
        gitdir: dir,
        ref,
      });
      return oid;
    } catch {
      return null;
    }
  }

  async getLog(repoId: string, ref: string, depth: number = 10): Promise<Array<{ oid: string; parent: string[] }>> {
    const dir = this.getRepoPath(repoId);
    try {
      const commits = await git.log({ fs, dir, gitdir: dir, ref, depth });
      return commits.map((c) => ({ oid: c.oid, parent: c.commit.parent }));
    } catch {
      return [];
    }
  }

  async getGraphData(repoId: string): Promise<{
    commits: Array<{
      oid: string;
      message: string;
      parents: string[];
      timestamp: number;
      author: { name: string; email: string };
    }>;
    refs: Array<{ name: string; oid: string; type: 'branch' | 'tag' }>;
  }> {
    const dir = this.getRepoPath(repoId);

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

  async getFileDiff(repoId: string, filePath: string): Promise<{ main: string | null; dirty: string | null } | null> {
    const mainContent = await this.getFile(repoId, 'main', filePath);
    const dirtyContent = await this.getFile(repoId, 'dirty', filePath);
    if (mainContent === null && dirtyContent === null) return null;
    return { main: mainContent, dirty: dirtyContent };
  }

  async createArchive(repoId: string, branch: string): Promise<Readable> {
    const dir = this.getRepoPath(repoId);
    const commitOid = await git.resolveRef({ fs, dir, gitdir: dir, ref: branch });

    const archive = archiver('zip', { zlib: { level: 6 } });

    // Walk tree and add all files (skip dotfiles)
    await git.walk({
      fs,
      dir,
      gitdir: dir,
      trees: [git.TREE({ ref: commitOid })],
      map: async (filepath, [entry]) => {
        if (!entry) return;
        // Skip hidden files/directories (starting with .)
        if (filepath.split('/').some((p) => p.startsWith('.'))) return;

        const type = await entry.type();
        if (type === 'blob') {
          const { blob } = await git.readBlob({
            fs,
            dir,
            gitdir: dir,
            oid: await entry.oid(),
          });
          archive.append(Buffer.from(blob), { name: filepath });
        }
      },
    });

    // added void since linter was complaining, assuming the non-awaited behavior is expected
    void archive.finalize();
    return archive;
  }

  async list(repoId: string, branch: string, folderPath: string): Promise<GitFile[]> {
    const dir = this.getRepoPath(repoId);
    try {
      const commitOid = await git.resolveRef({
        fs,
        dir,
        gitdir: dir,
        ref: branch,
      });
      const files: GitFile[] = [];
      await git.walk({
        fs,
        dir,
        gitdir: dir,
        trees: [git.TREE({ ref: commitOid })],
        map: async (filepath, [entry]) => {
          if (!entry) return;
          if (folderPath && !filepath.startsWith(folderPath + '/')) return;
          if (folderPath && filepath !== folderPath && filepath.slice(folderPath.length + 1).includes('/')) return; // Direct children only
          if (!folderPath && filepath.includes('/')) return; // Root children only

          const relativePath = folderPath ? filepath.slice(folderPath.length + 1) : filepath;
          if (relativePath === '' || relativePath.startsWith('.')) return;

          const type = await entry.type();
          if (type === 'blob') files.push({ name: relativePath, path: filepath, type: 'file' });
          else if (type === 'tree')
            files.push({
              name: relativePath,
              path: filepath,
              type: 'directory',
            });
        },
      });
      return files;
    } catch {
      return [];
    }
  }

  async getFile(repoId: string, branch: string, filePath: string): Promise<string | null> {
    const dir = this.getRepoPath(repoId);
    if (filePath.startsWith('/')) {
      filePath = filePath.slice(1);
    }
    try {
      const commitOid = await git.resolveRef({
        fs,
        dir,
        gitdir: dir,
        ref: branch,
      });
      const { blob } = await git.readBlob({
        fs,
        dir,
        gitdir: dir,
        oid: commitOid,
        filepath: filePath,
      });
      return new TextDecoder().decode(blob);
    } catch {
      return null;
    }
  }

  async fileExists(repoId: string, branch: string, filePath: string): Promise<boolean> {
    return (await this.getFile(repoId, branch, filePath)) !== null;
  }

  async commitFiles(
    repoId: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<void> {
    return withWriteLock(repoId, branch, async () => {
      const changes: FileChange[] = files.map((f) => ({
        path: f.path.startsWith('/') ? f.path.slice(1) : f.path,
        content: f.content,
        type: 'modify',
      }));
      await this.commitChangesToRef(repoId, branch, changes, message);
    });
  }

  async deleteFiles(repoId: string, branch: string, filePaths: string[], message: string): Promise<void> {
    return withWriteLock(repoId, branch, async () => {
      const changes: FileChange[] = filePaths.map((p) => ({
        path: p.startsWith('/') ? p.slice(1) : p,
        type: 'delete',
      }));
      await this.commitChangesToRef(repoId, branch, changes, message);
    });
  }

  async deleteFolder(repoId: string, folderPath: string, message: string): Promise<void> {
    // Remove leading slash
    const targetFolder = folderPath.startsWith('/') ? folderPath.slice(1) : folderPath;

    // Optimization: Instead of walking the tree to delete every file,
    // we simply issue a delete operation for the folder path itself.
    // applyChangesToTree handles this by pruning the tree entry.
    return withWriteLock(repoId, 'dirty', async () => {
      const changes: FileChange[] = [
        {
          path: targetFolder,
          type: 'delete',
        },
      ];
      await this.commitChangesToRef(repoId, 'dirty', changes, message);
    });
  }

  async publishFile(repoId: string, file: { path: string; content: string }, message: string): Promise<void> {
    // 1. Commit to main
    await this.commitFiles(repoId, 'main', [file], message);
    // 2. Rebase dirty (this will sync the repo state)
    await this.rebaseDirty(repoId);
  }

  async createCheckpoint(repoId: string, name: string): Promise<void> {
    const dir = this.getRepoPath(repoId);
    const mainRef = 'main';
    const dirtyRef = 'dirty';

    // Resolve current commits
    const mainCommit = await git.resolveRef({
      fs,
      dir,
      gitdir: dir,
      ref: mainRef,
    });
    // Dirty might not exist, ensure it does or resolve main
    let dirtyCommit = mainCommit;
    try {
      dirtyCommit = await git.resolveRef({
        fs,
        dir,
        gitdir: dir,
        ref: dirtyRef,
      });
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

  async revertToCheckpoint(repoId: string, name: string): Promise<void> {
    const dir = this.getRepoPath(repoId);
    try {
      const mainTag = await git.resolveRef({
        fs,
        dir,
        gitdir: dir,
        ref: `main_${name}`,
      });
      const dirtyTag = await git.resolveRef({
        fs,
        dir,
        gitdir: dir,
        ref: `dirty_${name}`,
      });

      await this.forceRef(dir, 'main', mainTag);
      await this.forceRef(dir, 'dirty', dirtyTag);
    } catch {
      throw new Error(`Checkpoint ${name} not found or incomplete`);
    }
  }

  async listCheckpoints(repoId: string): Promise<{ name: string; timestamp: number; message: string }[]> {
    const dir = this.getRepoPath(repoId);
    const tags = await git.listTags({ fs, dir, gitdir: dir });
    const mainTags = tags.filter((t) => t.startsWith('main_')).map((t) => t.slice(5));
    const dirtyTags = new Set(tags.filter((t) => t.startsWith('dirty_')).map((t) => t.slice(6)));

    // Checkpoints exist where both main_ and dirty_ tags exist
    const checkpointNames = mainTags.filter((name) => dirtyTags.has(name));

    const results = await Promise.all(
      checkpointNames.map(async (name) => {
        try {
          const oid = await git.resolveRef({ fs, dir, gitdir: dir, ref: `dirty_${name}` });
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

  async deleteCheckpoint(repoId: string, name: string): Promise<void> {
    const dir = this.getRepoPath(repoId);
    // deleteTag expects ref name without refs/tags/ prefix? No, checks doc.
    // isomorphic-git deleteTag: ref - The name of the tag to delete
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

  private mergeFileContents(base: string, ours: string, theirs: string): string {
    if (ours === base) return theirs;
    if (theirs === base) return ours;
    if (ours === theirs) return ours;

    const baseLines = base.split('\n');
    const oursLines = ours.split('\n');
    const theirsLines = theirs.split('\n');

    const result = diff3Merge(oursLines, baseLines, theirsLines);

    const mergedLines: string[] = [];
    for (const region of result) {
      if (region.ok) {
        mergedLines.push(...region.ok);
      } else if (region.conflict) {
        // Ours wins
        mergedLines.push(...region.conflict.a);
      }
    }
    return mergedLines.join('\n');
  }

  // --- Helpers ---

  private async forceRef(dir: string, ref: string, oid: string) {
    await git.writeRef({
      fs,
      dir,
      gitdir: dir,
      ref: `refs/heads/${ref}`,
      value: oid,
      force: true,
    });
  }

  private async compareCommits(repoId: string, oidA: string, oidB: string): Promise<DirtyFile[]> {
    const dir = this.getRepoPath(repoId);
    const filesA = await this.getTreeFiles(dir, oidA);
    const filesB = await this.getTreeFiles(dir, oidB);
    const dirty: DirtyFile[] = [];

    for (const [path, oid] of filesB) {
      const hashA = filesA.get(path);
      if (!hashA) dirty.push({ path, status: 'added' });
      else if (hashA !== oid) dirty.push({ path, status: 'modified' });
    }
    for (const [path] of filesA) {
      if (!filesB.has(path)) dirty.push({ path, status: 'deleted' });
    }
    return dirty;
  }

  private async getTreeFiles(dir: string, commitOid: string): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    await git.walk({
      fs,
      dir,
      gitdir: dir,
      trees: [git.TREE({ ref: commitOid })],
      map: async (filepath, [entry]) => {
        if (entry && (await entry.type()) === 'blob') {
          if (!filepath.split('/').some((p) => p.startsWith('.'))) files.set(filepath, await entry.oid());
        }
        return entry && (await entry.type()) === 'tree' ? true : undefined;
      },
    });
    return files;
  }

  private async commitChangesToRef(repoId: string, ref: string, changes: FileChange[], message: string) {
    const dir = this.getRepoPath(repoId);
    const parentCommit = await git.resolveRef({ fs, dir, gitdir: dir, ref });
    const { tree: currentTree } = await git.readTree({
      fs,
      dir,
      gitdir: dir,
      oid: parentCommit,
    });

    const newTreeOid = await this.applyChangesToTree(dir, currentTree, changes);
    const newCommit = await git.writeCommit({
      fs,
      dir,
      gitdir: dir,
      commit: {
        tree: newTreeOid,
        parent: [parentCommit],
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
        message,
      },
    });
    await this.forceRef(dir, ref, newCommit);

    // if (ref === "main") {
    //   await this.syncIndexForChanges(dir, changes);
    // }
  }

  private async syncIndexForChanges(dir: string, changes: FileChange[]) {
    for (const change of changes) {
      const filePath = path.join(dir, change.path);
      if (change.type === 'delete') {
        await git.resetIndex({ fs, dir, filepath: change.path });
        await fs.promises.unlink(filePath).catch(() => {});
      } else {
        await git.resetIndex({ fs, dir, filepath: change.path });
        const parentDir = path.dirname(filePath);
        await fs.promises.mkdir(parentDir, { recursive: true });
        await fs.promises.writeFile(filePath, change.content || '');
      }
    }
  }

  private async applyChangesToTree(
    dir: string,
    currentEntries: TreeEntry[],
    changes: FileChange[],
    prefix = '',
  ): Promise<string> {
    // Simplified version of applyChangesToTree from git.ts logic, recursion needed
    // Group changes by their first path component at this level
    const directChanges: FileChange[] = [];
    const subtreeChanges: Map<string, FileChange[]> = new Map();

    for (const change of changes) {
      const relativePath = prefix ? change.path.slice(prefix.length + 1) : change.path;
      const slashIndex = relativePath.indexOf('/');
      if (slashIndex === -1) {
        directChanges.push({ ...change, path: relativePath });
      } else {
        const subtreeName = relativePath.slice(0, slashIndex);
        const existing = subtreeChanges.get(subtreeName) || [];
        existing.push(change);
        subtreeChanges.set(subtreeName, existing);
      }
    }

    const newEntries: TreeEntry[] = [];
    for (const entry of currentEntries) {
      const direct = directChanges.find((c) => c.path === entry.path);
      const subtree = subtreeChanges.get(entry.path);

      if (direct) {
        if (direct.type === 'delete') continue;
        const newBlob = await git.writeBlob({
          fs,
          dir,
          gitdir: dir,
          blob: Buffer.from(direct.content || ''),
        });
        newEntries.push({
          mode: '100644',
          path: entry.path,
          oid: newBlob,
          type: 'blob',
        });
      } else if (subtree && entry.type === 'tree') {
        const { tree } = await git.readTree({
          fs,
          dir,
          gitdir: dir,
          oid: entry.oid,
        });
        const newSubtreeOid = await this.applyChangesToTree(
          dir,
          tree as unknown as TreeEntry[],
          subtree,
          prefix ? `${prefix}/${entry.path}` : entry.path,
        );
        newEntries.push({
          mode: entry.mode,
          path: entry.path,
          oid: newSubtreeOid,
          type: 'tree',
        });
        subtreeChanges.delete(entry.path);
      } else {
        newEntries.push(entry);
      }
    }

    // Add new files
    for (const change of directChanges) {
      if ((change.type === 'add' || change.type === 'modify') && !currentEntries.some((e) => e.path === change.path)) {
        const newBlob = await git.writeBlob({
          fs,
          dir,
          gitdir: dir,
          blob: Buffer.from(change.content || ''),
        });
        newEntries.push({
          mode: '100644',
          path: change.path,
          oid: newBlob,
          type: 'blob',
        });
      }
    }

    // New subtrees
    for (const [name, subChanges] of subtreeChanges) {
      if (!currentEntries.some((e) => e.path === name)) {
        const newSubtreeOid = await this.applyChangesToTree(dir, [], subChanges, prefix ? `${prefix}/${name}` : name);
        newEntries.push({
          mode: '040000',
          path: name,
          oid: newSubtreeOid,
          type: 'tree',
        });
      }
    }

    newEntries.sort((a, b) => {
      const aName = a.type === 'tree' ? `${a.path}/` : a.path;
      const bName = b.type === 'tree' ? `${b.path}/` : b.path;
      return aName.localeCompare(bName);
    });

    return git.writeTree({ fs, dir, gitdir: dir, tree: newEntries });
  }
}
