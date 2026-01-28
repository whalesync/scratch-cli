import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";

import { IGitService, GitFile, DirtyFile, FileChange } from "./types";

const REPOS_BASE_DIR = process.env.GIT_REPOS_DIR || "repos";
const DEFAULT_AUTHOR = { name: "Scratch", email: "scratch@example.com" };
const writeLocks = new Map<string, Promise<unknown>>();

async function withWriteLock<T>(
  gitBucket: string,
  ref: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockKey = `${gitBucket}:${ref}`;
  const previousPromise = writeLocks.get(lockKey);
  const ourPromise = (async () => {
    if (previousPromise) {
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
    return path.join(process.cwd(), REPOS_BASE_DIR, `${repoId}.git`);
  }

  async initRepo(repoId: string): Promise<void> {
    const dir = this.getRepoPath(repoId);
    await fs.promises.mkdir(dir, { recursive: true });

    // Check if HEAD exists (bare repo structure)
    if (!fs.existsSync(path.join(dir, "HEAD"))) {
      await git.init({
        fs,
        dir,
        gitdir: dir,
        defaultBranch: "main",
        bare: true,
      });
    }

    // Create initial commit if empty
    try {
      await git.resolveRef({ fs, dir, gitdir: dir, ref: "main" });
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
          message: "Initial commit",
        },
      });
      // Point main to this commit
      await this.forceRef(dir, "main", commitOid);

      // Ensure dirty branch exists and points to main
      await git.branch({
        fs,
        dir,
        gitdir: dir,
        ref: "dirty",
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
  ): Promise<{ rebased: boolean; conflicts: string[] }> {
    const dir = this.getRepoPath(repoId);
    const mainRef = "main";
    const dirtyRef = "dirty";

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
    const mergeBase = mergeBaseOids[0];

    // Get changes on dirty since mergeBase
    const userChanges = await this.compareCommits(
      repoId,
      mergeBase,
      dirtyCommit,
    );

    if (userChanges.length === 0) {
      await this.forceRef(dir, dirtyRef, mainCommit);
      return { rebased: true, conflicts: [] };
    }

    // Get content of changes
    const edits = await Promise.all(
      userChanges.map(async (change) => {
        if (change.status === "deleted") {
          return {
            path: change.path,
            status: "deleted" as const,
            content: null,
          };
        }
        const content = await this.getFile(repoId, dirtyRef, change.path);
        return { path: change.path, status: change.status, content };
      }),
    );

    // Reset dirty to new main
    await this.forceRef(dir, dirtyRef, mainCommit);

    // Apply edits
    const conflicts: string[] = [];
    const changesToCommit: FileChange[] = [];

    for (const edit of edits) {
      if (edit.status === "deleted") {
        const existsOnMain = await this.fileExists(repoId, mainRef, edit.path);
        if (existsOnMain)
          changesToCommit.push({ path: edit.path, type: "delete" });
      } else if (edit.content !== null) {
        const mainContent = await this.getFile(repoId, mainRef, edit.path);
        if (mainContent !== null && mainContent !== edit.content) {
          conflicts.push(edit.path);
        }
        changesToCommit.push({
          path: edit.path,
          content: edit.content,
          type: "modify",
        });
      }
    }

    if (changesToCommit.length > 0) {
      await this.commitChangesToRef(
        repoId,
        dirtyRef,
        changesToCommit,
        "Rebase dirty on main",
      );
    }

    return { rebased: true, conflicts };
  }

  async getDirtyStatus(repoId: string): Promise<DirtyFile[]> {
    const dir = this.getRepoPath(repoId);
    const mainRef = "main";
    const dirtyRef = "dirty";
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

  async getFileDiff(
    repoId: string,
    filePath: string,
  ): Promise<{ main: string | null; dirty: string | null } | null> {
    const mainContent = await this.getFile(repoId, "main", filePath);
    const dirtyContent = await this.getFile(repoId, "dirty", filePath);
    if (mainContent === null && dirtyContent === null) return null;
    return { main: mainContent, dirty: dirtyContent };
  }

  async list(
    repoId: string,
    branch: string,
    folderPath: string,
  ): Promise<GitFile[]> {
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
          if (folderPath && !filepath.startsWith(folderPath + "/")) return;
          if (
            folderPath &&
            filepath !== folderPath &&
            filepath.slice(folderPath.length + 1).includes("/")
          )
            return; // Direct children only
          if (!folderPath && filepath.includes("/")) return; // Root children only

          const relativePath = folderPath
            ? filepath.slice(folderPath.length + 1)
            : filepath;
          if (relativePath === "" || relativePath.startsWith(".")) return;

          const type = await entry.type();
          if (type === "blob")
            files.push({ name: relativePath, path: filepath, type: "file" });
          else if (type === "tree")
            files.push({
              name: relativePath,
              path: filepath,
              type: "directory",
            });
        },
      });
      return files;
    } catch {
      return [];
    }
  }

  async getFile(
    repoId: string,
    branch: string,
    filePath: string,
  ): Promise<string | null> {
    const dir = this.getRepoPath(repoId);
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

  async fileExists(
    repoId: string,
    branch: string,
    filePath: string,
  ): Promise<boolean> {
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
        path: f.path,
        content: f.content,
        type: "modify",
      }));
      await this.commitChangesToRef(repoId, branch, changes, message);
    });
  }

  async deleteFiles(
    repoId: string,
    branch: string,
    filePaths: string[],
    message: string,
  ): Promise<void> {
    return withWriteLock(repoId, branch, async () => {
      const changes: FileChange[] = filePaths.map((p) => ({
        path: p,
        type: "delete",
      }));
      await this.commitChangesToRef(repoId, branch, changes, message);
    });
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

  private async compareCommits(
    repoId: string,
    oidA: string,
    oidB: string,
  ): Promise<DirtyFile[]> {
    const dir = this.getRepoPath(repoId);
    const filesA = await this.getTreeFiles(dir, oidA);
    const filesB = await this.getTreeFiles(dir, oidB);
    const dirty: DirtyFile[] = [];

    for (const [path, oid] of filesB) {
      const hashA = filesA.get(path);
      if (!hashA) dirty.push({ path, status: "added" });
      else if (hashA !== oid) dirty.push({ path, status: "modified" });
    }
    for (const [path] of filesA) {
      if (!filesB.has(path)) dirty.push({ path, status: "deleted" });
    }
    return dirty;
  }

  private async getTreeFiles(
    dir: string,
    commitOid: string,
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    await git.walk({
      fs,
      dir,
      gitdir: dir,
      trees: [git.TREE({ ref: commitOid })],
      map: async (filepath, [entry]) => {
        if (entry && (await entry.type()) === "blob") {
          if (!filepath.split("/").some((p) => p.startsWith(".")))
            files.set(filepath, await entry.oid());
        }
        return entry && (await entry.type()) === "tree" ? true : undefined;
      },
    });
    return files;
  }

  private async commitChangesToRef(
    repoId: string,
    ref: string,
    changes: FileChange[],
    message: string,
  ) {
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

    if (ref === "main") {
      await this.syncIndexForChanges(dir, changes);
    }
  }

  private async syncIndexForChanges(dir: string, changes: FileChange[]) {
    for (const change of changes) {
      const filePath = path.join(dir, change.path);
      if (change.type === "delete") {
        await git.resetIndex({ fs, dir, filepath: change.path });
        await fs.promises.unlink(filePath).catch(() => {});
      } else {
        await git.resetIndex({ fs, dir, filepath: change.path });
        const parentDir = path.dirname(filePath);
        await fs.promises.mkdir(parentDir, { recursive: true });
        await fs.promises.writeFile(filePath, change.content || "");
      }
    }
  }

  private async applyChangesToTree(
    dir: string,
    currentEntries: any[],
    changes: FileChange[],
    prefix = "",
  ): Promise<string> {
    // Simplified version of applyChangesToTree from git.ts logic, recursion needed
    // Group changes by their first path component at this level
    const directChanges: FileChange[] = [];
    const subtreeChanges: Map<string, FileChange[]> = new Map();

    for (const change of changes) {
      const relativePath = prefix
        ? change.path.slice(prefix.length + 1)
        : change.path;
      const slashIndex = relativePath.indexOf("/");
      if (slashIndex === -1) {
        directChanges.push({ ...change, path: relativePath });
      } else {
        const subtreeName = relativePath.slice(0, slashIndex);
        const existing = subtreeChanges.get(subtreeName) || [];
        existing.push(change);
        subtreeChanges.set(subtreeName, existing);
      }
    }

    const newEntries: any[] = [];
    for (const entry of currentEntries) {
      const direct = directChanges.find((c) => c.path === entry.path);
      const subtree = subtreeChanges.get(entry.path);

      if (direct) {
        if (direct.type === "delete") continue;
        const newBlob = await git.writeBlob({
          fs,
          dir,
          gitdir: dir,
          blob: Buffer.from(direct.content || ""),
        });
        newEntries.push({
          mode: "100644",
          path: entry.path,
          oid: newBlob,
          type: "blob",
        });
      } else if (subtree && entry.type === "tree") {
        const { tree } = await git.readTree({
          fs,
          dir,
          gitdir: dir,
          oid: entry.oid,
        });
        const newSubtree = await this.applyChangesToTree(
          dir,
          tree,
          subtree,
          prefix ? `${prefix}/${entry.path}` : entry.path,
        );
        newEntries.push({
          mode: entry.mode,
          path: entry.path,
          oid: newSubtree,
          type: "tree",
        });
        subtreeChanges.delete(entry.path);
      } else {
        newEntries.push(entry);
      }
    }

    // Add new files
    for (const change of directChanges) {
      if (
        (change.type === "add" || change.type === "modify") &&
        !currentEntries.some((e) => e.path === change.path)
      ) {
        const newBlob = await git.writeBlob({
          fs,
          dir,
          gitdir: dir,
          blob: Buffer.from(change.content || ""),
        });
        newEntries.push({
          mode: "100644",
          path: change.path,
          oid: newBlob,
          type: "blob",
        });
      }
    }

    // New subtrees
    for (const [name, subChanges] of subtreeChanges) {
      if (!currentEntries.some((e) => e.path === name)) {
        const newSubtree = await this.applyChangesToTree(
          dir,
          [],
          subChanges,
          prefix ? `${prefix}/${name}` : name,
        );
        newEntries.push({
          mode: "040000",
          path: name,
          oid: newSubtree,
          type: "tree",
        });
      }
    }

    newEntries.sort((a, b) => {
      const aName = a.type === "tree" ? `${a.path}/` : a.path;
      const bName = b.type === "tree" ? `${b.path}/` : b.path;
      return aName.localeCompare(bName);
    });

    return git.writeTree({ fs, dir, gitdir: dir, tree: newEntries });
  }
}
