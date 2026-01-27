import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";

// Base directory for git repos (local development)
const REPOS_BASE_DIR = process.env.GIT_REPOS_DIR || ".scratch-repos";

// Default author for commits
const DEFAULT_AUTHOR = { name: "Scratch", email: "scratch@example.com" };

// Lock mechanism for serializing writes to the same branch
// Maps "gitBucket:ref" to the last promise in the queue
const writeLocks = new Map<string, Promise<unknown>>();

/**
 * Execute a write operation with serialization to prevent race conditions.
 * This ensures concurrent writes to the same branch are executed sequentially.
 * Each new write waits for ALL previous writes to complete.
 */
async function withWriteLock<T>(
  gitBucket: string,
  ref: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockKey = `${gitBucket}:${ref}`;

  // Get the current tail of the queue (if any)
  const previousPromise = writeLocks.get(lockKey);

  // Create our operation that waits for the previous one
  const ourPromise = (async () => {
    // Wait for previous write to complete (ignore its errors)
    if (previousPromise) {
      await previousPromise.catch(() => {});
    }
    // Now execute our operation
    return operation();
  })();

  // Add ourselves to the queue immediately (before awaiting)
  writeLocks.set(lockKey, ourPromise);

  try {
    return await ourPromise;
  } finally {
    // Only clear the lock if we're still the last one in the queue
    if (writeLocks.get(lockKey) === ourPromise) {
      writeLocks.delete(lockKey);
    }
  }
}

// =============================================================================
// FILE CHANGE TYPES
// =============================================================================

/**
 * Represents a file change to be committed.
 * Use 'add' for new files and 'modify' for existing files (both write content).
 * Use 'delete' to remove a file.
 */
export interface FileChange {
  path: string;
  content?: string; // Required for add/modify, not used for delete
  type: "add" | "modify" | "delete";
}

// =============================================================================
// DIRECT OBJECT MANIPULATION - CORE FUNCTIONS
//
// IMPORTANT: These functions write to git branches WITHOUT using checkout.
// This is critical for correctness because checkout-based writes depend on
// hidden "current branch" state, which can lead to writes going to the wrong
// branch if any operation forgets to restore the branch.
//
// All write operations in this codebase MUST use these functions or their
// wrappers (writeFilesToMain, writeFilesToDirtyBranch, etc.).
//
// See docs/git-design.md for full documentation.
// =============================================================================

/**
 * Tree entry as returned by isomorphic-git's readTree
 */
interface TreeEntry {
  mode: string;
  path: string;
  oid: string;
  type: "blob" | "tree" | "commit";
}

/**
 * Commit file changes to a specific ref (branch) using direct object manipulation.
 * This does NOT use checkout - it manipulates git objects directly.
 *
 * @param gitBucket - The git bucket (repo identifier)
 * @param ref - The branch name to commit to (e.g., "main" or "dirty/user123")
 * @param changes - Array of file changes to commit
 * @param message - Commit message
 * @returns The new commit SHA
 */
export async function commitChangesToRef(
  gitBucket: string,
  ref: string,
  changes: FileChange[],
  message: string,
): Promise<string> {
  const dir = getRepoPath(gitBucket);

  // Get the current commit of the target ref
  const parentCommit = await git.resolveRef({ fs, dir, ref });

  // Get the current tree from that commit
  const { tree: currentTree } = await git.readTree({
    fs,
    dir,
    oid: parentCommit,
  });

  // Apply changes to build the new tree
  const newTreeOid = await applyChangesToTree(
    dir,
    currentTree,
    changes,
    "", // root path prefix
  );

  // Create commit pointing to new tree
  const newCommit = await git.writeCommit({
    fs,
    dir,
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

  // Update the ref to point to new commit
  await git.writeRef({
    fs,
    dir,
    ref: `refs/heads/${ref}`,
    value: newCommit,
    force: true,
  });

  // If we're committing to main, sync the index to match
  // This keeps the index in sync with HEAD (which points to main)
  if (ref === "main") {
    await syncIndexForChanges(dir, changes);
  }

  return newCommit;
}

/**
 * Sync the git index and working directory for a set of file changes.
 * This ensures both match HEAD after we update main.
 */
async function syncIndexForChanges(
  dir: string,
  changes: FileChange[],
): Promise<void> {
  for (const change of changes) {
    const filePath = path.join(dir, change.path);

    if (change.type === "delete") {
      // Remove the file from the index and working directory
      await git.resetIndex({ fs, dir, filepath: change.path });
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // File may not exist in working directory, ignore
      }
    } else {
      // Reset the index entry to match HEAD
      await git.resetIndex({ fs, dir, filepath: change.path });
      // Write the content to the working directory
      const parentDir = path.dirname(filePath);
      await fs.promises.mkdir(parentDir, { recursive: true });
      await fs.promises.writeFile(filePath, change.content || "");
    }
  }
}

/**
 * Apply file changes to a tree and return the new tree OID.
 * This recursively builds new tree objects as needed.
 */
async function applyChangesToTree(
  dir: string,
  currentEntries: TreeEntry[],
  changes: FileChange[],
  pathPrefix: string,
): Promise<string> {
  // Group changes by their first path component at this level
  const directChanges: FileChange[] = [];
  const subtreeChanges: Map<string, FileChange[]> = new Map();

  for (const change of changes) {
    // Get the path relative to current tree level
    const relativePath = pathPrefix
      ? change.path.slice(pathPrefix.length + 1)
      : change.path;

    const slashIndex = relativePath.indexOf("/");
    if (slashIndex === -1) {
      // This change is for a file directly in this tree
      directChanges.push({ ...change, path: relativePath });
    } else {
      // This change is for a file in a subtree
      const subtreeName = relativePath.slice(0, slashIndex);
      const existing = subtreeChanges.get(subtreeName) || [];
      existing.push(change);
      subtreeChanges.set(subtreeName, existing);
    }
  }

  // Build new entries array
  const newEntries: TreeEntry[] = [];

  // Process existing entries
  for (const entry of currentEntries) {
    // Check if this entry is being modified or deleted
    const directChange = directChanges.find((c) => c.path === entry.path);
    const subtreeChange = subtreeChanges.get(entry.path);

    if (directChange) {
      if (directChange.type === "delete") {
        // Skip this entry (delete it)
        continue;
      }
      // Replace with new content
      const newBlobOid = await git.writeBlob({
        fs,
        dir,
        blob: Buffer.from(directChange.content || ""),
      });
      newEntries.push({
        mode: "100644",
        path: entry.path,
        oid: newBlobOid,
        type: "blob",
      });
    } else if (subtreeChange && entry.type === "tree") {
      // Recursively process subtree
      const { tree: subtreeEntries } = await git.readTree({
        fs,
        dir,
        oid: entry.oid,
      });
      const newSubtreeOid = await applyChangesToTree(
        dir,
        subtreeEntries,
        subtreeChange,
        pathPrefix ? `${pathPrefix}/${entry.path}` : entry.path,
      );
      newEntries.push({
        mode: entry.mode,
        path: entry.path,
        oid: newSubtreeOid,
        type: "tree",
      });
      subtreeChanges.delete(entry.path);
    } else {
      // Keep existing entry unchanged
      newEntries.push(entry);
    }
  }

  // Add new files (not replacing existing)
  // Both "add" and "modify" types can create new files
  for (const change of directChanges) {
    if (
      (change.type === "add" || change.type === "modify") &&
      !currentEntries.some((e) => e.path === change.path)
    ) {
      const newBlobOid = await git.writeBlob({
        fs,
        dir,
        blob: Buffer.from(change.content || ""),
      });
      newEntries.push({
        mode: "100644",
        path: change.path,
        oid: newBlobOid,
        type: "blob",
      });
    }
  }

  // Create new subtrees for paths that don't exist yet
  for (const [subtreeName, subtreeChanges_] of subtreeChanges) {
    if (!currentEntries.some((e) => e.path === subtreeName)) {
      // Create new subtree
      const newSubtreeOid = await applyChangesToTree(
        dir,
        [], // empty tree - all entries are new
        subtreeChanges_,
        pathPrefix ? `${pathPrefix}/${subtreeName}` : subtreeName,
      );
      newEntries.push({
        mode: "040000",
        path: subtreeName,
        oid: newSubtreeOid,
        type: "tree",
      });
    }
  }

  // Sort entries (git requires sorted tree entries)
  newEntries.sort((a, b) => {
    // Git sorts directories with a trailing slash for comparison purposes
    const aName = a.type === "tree" ? `${a.path}/` : a.path;
    const bName = b.type === "tree" ? `${b.path}/` : b.path;
    return aName.localeCompare(bName);
  });

  // Write the new tree
  const newTreeOid = await git.writeTree({
    fs,
    dir,
    tree: newEntries,
  });

  return newTreeOid;
}

// =============================================================================
// BRANCH-EXPLICIT READ OPERATIONS
//
// These functions read from git branches WITHOUT using the working directory.
// This ensures reads are always from the correct branch regardless of checkout state.
// =============================================================================

/**
 * Check if a file exists on a specific branch.
 * Uses git objects directly - no working directory required.
 */
export async function fileExistsOnBranch(
  gitBucket: string,
  branchName: string,
  filePath: string,
): Promise<boolean> {
  const dir = getRepoPath(gitBucket);

  try {
    const commitOid = await git.resolveRef({ fs, dir, ref: branchName });
    await git.readBlob({
      fs,
      dir,
      oid: commitOid,
      filepath: filePath,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a file exists on the main branch.
 */
export async function fileExistsOnMain(
  gitBucket: string,
  filePath: string,
): Promise<boolean> {
  return fileExistsOnBranch(gitBucket, "main", filePath);
}

/**
 * Check if a file exists on a user's dirty branch.
 * Falls back to main if dirty branch doesn't exist.
 */
export async function fileExistsOnDirtyBranch(
  gitBucket: string,
  userId: string,
  filePath: string,
): Promise<boolean> {
  const branchName = getDirtyBranchName(userId);

  // Try dirty branch first, fall back to main if branch doesn't exist
  if (await branchExists(gitBucket, branchName)) {
    return fileExistsOnBranch(gitBucket, branchName, filePath);
  }
  return fileExistsOnMain(gitBucket, filePath);
}

/**
 * Read file content from the main branch.
 */
export async function readFileFromMain(
  gitBucket: string,
  filePath: string,
): Promise<GitFileContent | null> {
  const content = await readFileFromBranch(gitBucket, "main", filePath);
  if (content === null) {
    return null;
  }
  return {
    name: path.basename(filePath),
    path: filePath,
    content,
  };
}

/**
 * Read file content from a user's dirty branch.
 * Falls back to main if dirty branch doesn't exist.
 */
export async function readFileFromDirtyBranch(
  gitBucket: string,
  userId: string,
  filePath: string,
): Promise<GitFileContent | null> {
  const branchName = getDirtyBranchName(userId);

  // Fall back to main if dirty branch doesn't exist
  const targetBranch = (await branchExists(gitBucket, branchName))
    ? branchName
    : "main";

  const content = await readFileFromBranch(gitBucket, targetBranch, filePath);
  if (content === null) {
    return null;
  }
  return {
    name: path.basename(filePath),
    path: filePath,
    content,
  };
}

/**
 * List files in a directory from a user's dirty branch.
 * Falls back to main if dirty branch doesn't exist.
 */
export async function listFilesFromDirtyBranch(
  gitBucket: string,
  userId: string,
  dirPath: string,
): Promise<GitFile[]> {
  const branchName = getDirtyBranchName(userId);

  // Fall back to main if dirty branch doesn't exist
  const targetBranch = (await branchExists(gitBucket, branchName))
    ? branchName
    : "main";

  return listFilesFromBranch(gitBucket, targetBranch, dirPath);
}

// =============================================================================
// CONVENIENCE WRAPPERS FOR MAIN BRANCH
// =============================================================================

/**
 * Write multiple files to main branch in a single commit.
 * Uses direct object manipulation - no checkout required.
 * Concurrent writes are serialized to prevent race conditions.
 */
export async function writeFilesToMain(
  gitBucket: string,
  files: Array<{ path: string; content: string }>,
  message: string,
): Promise<string> {
  return withWriteLock(gitBucket, "main", async () => {
    const changes: FileChange[] = files.map((f) => ({
      path: f.path,
      content: f.content,
      type: "modify", // Works for both new and existing files
    }));
    return commitChangesToRef(gitBucket, "main", changes, message);
  });
}

/**
 * Delete multiple files from main branch in a single commit.
 * Uses direct object manipulation - no checkout required.
 * Concurrent deletes are serialized to prevent race conditions.
 */
export async function deleteFilesFromMain(
  gitBucket: string,
  filePaths: string[],
  message: string,
): Promise<string> {
  return withWriteLock(gitBucket, "main", async () => {
    const changes: FileChange[] = filePaths.map((path) => ({
      path,
      type: "delete",
    }));
    return commitChangesToRef(gitBucket, "main", changes, message);
  });
}

// =============================================================================
// CONVENIENCE WRAPPERS FOR DIRTY BRANCH
// =============================================================================

/**
 * Ensure a dirty branch exists for a user. Creates it from main if it doesn't exist.
 * This is the only function that creates dirty branches.
 */
export async function ensureDirtyBranchExists(
  gitBucket: string,
  userId: string,
): Promise<void> {
  const dir = getRepoPath(gitBucket);
  const branchName = getDirtyBranchName(userId);

  // Check if branch already exists
  const branches = await git.listBranches({ fs, dir });
  if (branches.includes(branchName)) {
    return;
  }

  // Create branch from main's current commit
  const mainCommit = await git.resolveRef({ fs, dir, ref: "main" });
  await git.writeRef({
    fs,
    dir,
    ref: `refs/heads/${branchName}`,
    value: mainCommit,
    force: false,
  });
}

/**
 * Write multiple files to a user's dirty branch in a single commit.
 * Creates the dirty branch if it doesn't exist.
 * Uses direct object manipulation - no checkout required.
 */
export async function writeFilesToDirtyBranch(
  gitBucket: string,
  userId: string,
  files: Array<{ path: string; content: string }>,
  message: string,
): Promise<string> {
  await ensureDirtyBranchExists(gitBucket, userId);
  const branchName = getDirtyBranchName(userId);
  const changes: FileChange[] = files.map((f) => ({
    path: f.path,
    content: f.content,
    type: "modify",
  }));
  return commitChangesToRef(gitBucket, branchName, changes, message);
}

/**
 * Delete multiple files from a user's dirty branch in a single commit.
 * Uses direct object manipulation - no checkout required.
 */
export async function deleteFilesFromDirtyBranch(
  gitBucket: string,
  userId: string,
  filePaths: string[],
  message: string,
): Promise<string> {
  await ensureDirtyBranchExists(gitBucket, userId);
  const branchName = getDirtyBranchName(userId);
  const changes: FileChange[] = filePaths.map((path) => ({
    path,
    type: "delete",
  }));
  return commitChangesToRef(gitBucket, branchName, changes, message);
}

export interface GitFile {
  name: string;
  path: string;
  type: "file" | "directory";
}

export interface GitFileContent {
  name: string;
  path: string;
  content: string;
}

export interface DirtyFile {
  path: string;
  status: "added" | "modified" | "deleted";
}

export type DirtyFileStatus = DirtyFile["status"];

/**
 * Get the filesystem path for a workspace's git repo
 */
export function getRepoPath(gitBucket: string): string {
  return path.join(process.cwd(), REPOS_BASE_DIR, gitBucket);
}

/**
 * Initialize a git repository for a workspace
 */
export async function initRepo(gitBucket: string): Promise<void> {
  const dir = getRepoPath(gitBucket);

  // Create directory if it doesn't exist
  await fs.promises.mkdir(dir, { recursive: true });

  const gitDir = path.join(dir, ".git");

  // Check if already initialized by looking for .git directory
  if (fs.existsSync(gitDir)) {
    // Check if HEAD exists (has initial commit)
    try {
      await git.resolveRef({ fs, dir, ref: "HEAD" });
      return; // Already initialized with commits
    } catch {
      // HEAD doesn't exist, need to create initial commit
    }
  } else {
    await git.init({ fs, dir, defaultBranch: "main" });

    // Verify .git was created
    if (!fs.existsSync(gitDir)) {
      throw new Error(`Failed to initialize git repo at ${dir}`);
    }
  }

  // Create initial commit with empty .gitkeep
  const gitkeepPath = path.join(dir, ".gitkeep");
  await fs.promises.writeFile(gitkeepPath, "");

  await git.add({ fs, dir, filepath: ".gitkeep" });
  await git.commit({
    fs,
    dir,
    message: "Initial commit",
    author: { name: "Scratch", email: "scratch@example.com" },
  });
}

// =====================
// Branch Management
// =====================

/**
 * Get the dirty branch name for a user
 */
export function getDirtyBranchName(userId: string): string {
  return `dirty/${userId}`;
}

/**
 * List all branches in the repo
 */
export async function listBranches(gitBucket: string): Promise<string[]> {
  const dir = getRepoPath(gitBucket);
  return git.listBranches({ fs, dir });
}

/**
 * Check if a branch exists
 */
export async function branchExists(
  gitBucket: string,
  branchName: string,
): Promise<boolean> {
  const dir = getRepoPath(gitBucket);
  try {
    await git.resolveRef({ fs, dir, ref: branchName });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a dirty branch for a user, branching from main
 * If the branch already exists, this does nothing
 */
export async function createDirtyBranch(
  gitBucket: string,
  userId: string,
): Promise<void> {
  const dir = getRepoPath(gitBucket);
  const branchName = getDirtyBranchName(userId);

  // Check if branch already exists
  if (await branchExists(gitBucket, branchName)) {
    return;
  }

  // Create the new branch pointing to main's current commit
  await git.branch({ fs, dir, ref: branchName, checkout: false });
}

/**
 * Compare two commits and return list of changed files
 */
async function compareCommits(
  gitBucket: string,
  commitA: string,
  commitB: string,
): Promise<DirtyFile[]> {
  const dirtyFiles: DirtyFile[] = [];

  // Build a map of files in each tree (recursively)
  const filesA = await getTreeFiles(gitBucket, commitA);
  const filesB = await getTreeFiles(gitBucket, commitB);

  // Find added and modified files (in B but not A, or different)
  for (const [filePath, oidB] of filesB) {
    const oidA = filesA.get(filePath);
    if (!oidA) {
      dirtyFiles.push({ path: filePath, status: "added" });
    } else if (oidA !== oidB) {
      dirtyFiles.push({ path: filePath, status: "modified" });
    }
  }

  // Find deleted files (in A but not B)
  for (const [filePath] of filesA) {
    if (!filesB.has(filePath)) {
      dirtyFiles.push({ path: filePath, status: "deleted" });
    }
  }

  return dirtyFiles;
}

/**
 * Recursively get all files in a tree with their OIDs
 */
async function getTreeFiles(
  gitBucket: string,
  commitOid: string,
): Promise<Map<string, string>> {
  const dir = getRepoPath(gitBucket);
  const files = new Map<string, string>();

  // Use git.walk to traverse the tree
  // The map function must return a truthy value for directories to recurse into them
  await git.walk({
    fs,
    dir,
    trees: [git.TREE({ ref: commitOid })],
    map: async (filepath, [entry]) => {
      if (!entry) return;

      const type = await entry.type();
      if (type === "blob") {
        const oid = await entry.oid();
        // Skip hidden files
        if (!filepath.split("/").some((part) => part.startsWith("."))) {
          files.set(filepath, oid);
        }
      }
      // Return true for directories to recurse into them
      return type === "tree" ? true : undefined;
    },
  });

  return files;
}

/**
 * Get list of dirty files for a user (comparing their dirty branch to main)
 * Returns empty array if user has no dirty branch
 */
export async function getDirtyFiles(
  gitBucket: string,
  userId: string,
): Promise<DirtyFile[]> {
  const dir = getRepoPath(gitBucket);
  const branchName = getDirtyBranchName(userId);

  // Check if dirty branch exists
  if (!(await branchExists(gitBucket, branchName))) {
    return [];
  }

  // Get the commit SHAs for both branches
  const [mainCommit, dirtyCommit] = await Promise.all([
    git.resolveRef({ fs, dir, ref: "main" }),
    git.resolveRef({ fs, dir, ref: branchName }),
  ]);

  // If they point to the same commit, no dirty files
  if (mainCommit === dirtyCommit) {
    return [];
  }

  // Compare the commits
  return compareCommits(gitBucket, mainCommit, dirtyCommit);
}

/**
 * Check if user has any dirty files
 */
export async function hasDirtyFiles(
  gitBucket: string,
  userId: string,
): Promise<boolean> {
  const dirtyFiles = await getDirtyFiles(gitBucket, userId);
  return dirtyFiles.length > 0;
}

/**
 * Discard all dirty changes for a user (reset their branch to main)
 *
 * Uses direct ref manipulation - no checkout required.
 */
export async function discardAllChanges(
  gitBucket: string,
  userId: string,
): Promise<number> {
  const dir = getRepoPath(gitBucket);
  const branchName = getDirtyBranchName(userId);

  // Get dirty files count before discarding
  const dirtyFiles = await getDirtyFiles(gitBucket, userId);
  const count = dirtyFiles.length;

  if (count === 0) {
    return 0;
  }

  // Get main's commit
  const mainCommit = await git.resolveRef({ fs, dir, ref: "main" });

  // Point the dirty branch ref directly to main's commit
  // No checkout needed - just update the ref
  await git.writeRef({
    fs,
    dir,
    ref: `refs/heads/${branchName}`,
    value: mainCommit,
    force: true,
  });

  return count;
}

/**
 * Discard changes to a single file (restore from main)
 *
 * Uses direct object manipulation - no checkout required.
 */
export async function discardFileChanges(
  gitBucket: string,
  userId: string,
  filePath: string,
): Promise<boolean> {
  // Ensure dirty branch exists
  await ensureDirtyBranchExists(gitBucket, userId);
  const branchName = getDirtyBranchName(userId);

  // Try to read the file from main
  const mainContent = await readFileFromBranch(gitBucket, "main", filePath);

  try {
    if (mainContent !== null) {
      // File exists in main, restore it by writing to dirty branch
      const changes: FileChange[] = [
        { path: filePath, content: mainContent, type: "modify" },
      ];
      await commitChangesToRef(
        gitBucket,
        branchName,
        changes,
        `Discard changes to ${path.basename(filePath)}`,
      );
    } else {
      // File doesn't exist in main - it's a new file, delete it from dirty branch
      const changes: FileChange[] = [{ path: filePath, type: "delete" }];
      await commitChangesToRef(
        gitBucket,
        branchName,
        changes,
        `Discard new file ${path.basename(filePath)}`,
      );
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file content from a specific branch
 */
export async function readFileFromBranch(
  gitBucket: string,
  branchName: string,
  filePath: string,
): Promise<string | null> {
  const dir = getRepoPath(gitBucket);

  try {
    const commitOid = await git.resolveRef({ fs, dir, ref: branchName });
    const { blob } = await git.readBlob({
      fs,
      dir,
      oid: commitOid,
      filepath: filePath,
    });
    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}

/**
 * Reset the dirty branch to match main (used after successful publish + pull)
 * This effectively "rebases" by resetting the dirty branch to main's state,
 * since any successfully published changes are now in main.
 *
 * Uses direct ref manipulation - no checkout required.
 */
export async function resetDirtyBranchToMain(
  gitBucket: string,
  userId: string,
): Promise<void> {
  const dir = getRepoPath(gitBucket);
  const branchName = getDirtyBranchName(userId);

  // Check if dirty branch exists
  if (!(await branchExists(gitBucket, branchName))) {
    return;
  }

  // Get main's commit
  const mainCommit = await git.resolveRef({ fs, dir, ref: "main" });

  // Point the dirty branch ref directly to main's commit
  // No checkout needed - just update the ref
  await git.writeRef({
    fs,
    dir,
    ref: `refs/heads/${branchName}`,
    value: mainCommit,
    force: true,
  });
}

/**
 * Rebase the dirty branch onto main by preserving user's edits.
 *
 * This simulates a rebase without true cherry-picking:
 * 1. Find the merge-base (where dirty branched from main)
 * 2. Get user's changes by comparing merge-base to dirty branch
 * 3. Reset dirty branch to new main
 * 4. Re-apply the user's edits on top of the new main
 *
 * This preserves the user's work while incorporating pulled changes.
 * Uses direct object manipulation - no checkout required.
 */
export async function rebaseDirtyBranchOntoMain(
  gitBucket: string,
  userId: string,
): Promise<{ rebased: boolean; conflicts: string[] }> {
  const dir = getRepoPath(gitBucket);
  const branchName = getDirtyBranchName(userId);

  // Check if dirty branch exists
  if (!(await branchExists(gitBucket, branchName))) {
    return { rebased: false, conflicts: [] };
  }

  // Get commit SHAs
  const [mainCommit, dirtyCommit] = await Promise.all([
    git.resolveRef({ fs, dir, ref: "main" }),
    git.resolveRef({ fs, dir, ref: branchName }),
  ]);

  // If already at same commit, nothing to do
  if (mainCommit === dirtyCommit) {
    return { rebased: true, conflicts: [] };
  }

  // Find merge-base (common ancestor)
  const mergeBaseOids = await git.findMergeBase({
    fs,
    dir,
    oids: [mainCommit, dirtyCommit],
  });

  if (mergeBaseOids.length === 0) {
    // No common ancestor - shouldn't happen in our model, but handle it
    // Just reset to main
    await resetDirtyBranchToMain(gitBucket, userId);
    return { rebased: true, conflicts: [] };
  }

  const mergeBase = mergeBaseOids[0];

  // Get user's actual changes (comparing merge-base to dirty branch)
  // This way files added to main AFTER the branch split won't appear as "deleted"
  const userChanges = await compareCommits(gitBucket, mergeBase, dirtyCommit);

  if (userChanges.length === 0) {
    // No user edits, just reset to main
    await resetDirtyBranchToMain(gitBucket, userId);
    return { rebased: true, conflicts: [] };
  }

  // Save the content of modified/added files from dirty branch
  const savedEdits: Array<{
    path: string;
    status: "added" | "modified" | "deleted";
    content: string | null;
  }> = [];

  for (const file of userChanges) {
    if (file.status === "deleted") {
      savedEdits.push({ path: file.path, status: "deleted", content: null });
    } else {
      // Read content from dirty branch
      const content = await readFileFromBranch(
        gitBucket,
        branchName,
        file.path,
      );
      savedEdits.push({ path: file.path, status: file.status, content });
    }
  }

  // Reset dirty branch to main using direct ref manipulation
  await git.writeRef({
    fs,
    dir,
    ref: `refs/heads/${branchName}`,
    value: mainCommit,
    force: true,
  });

  // Build changes to re-apply user's edits
  const conflicts: string[] = [];
  const changes: FileChange[] = [];

  for (const edit of savedEdits) {
    try {
      if (edit.status === "deleted") {
        // User deleted this file - check if it exists on main before deleting
        const existsOnMain = await fileExistsOnMain(gitBucket, edit.path);
        if (existsOnMain) {
          changes.push({ path: edit.path, type: "delete" });
        }
        // If file doesn't exist on main, nothing to do
      } else if (edit.content !== null) {
        // User added or modified this file
        // Check if file exists on new main and has different content
        const mainContent = await readFileFromBranch(
          gitBucket,
          "main",
          edit.path,
        );

        if (mainContent !== null && mainContent !== edit.content) {
          // File exists on main with different content - potential conflict
          // For now, user's edit wins (like git rebase with "theirs" strategy)
          conflicts.push(edit.path);
        }

        // Add user's version to changes
        changes.push({
          path: edit.path,
          content: edit.content,
          type: "modify",
        });
      }
    } catch (error) {
      console.error(`Failed to prepare edit for ${edit.path}:`, error);
      conflicts.push(edit.path);
    }
  }

  // Commit the re-applied edits if there are any changes
  if (changes.length > 0) {
    await commitChangesToRef(
      gitBucket,
      branchName,
      changes,
      "Rebase: Re-apply user edits after pull",
    );
  }

  return { rebased: true, conflicts };
}

/**
 * Write a single file to main branch and commit.
 * Uses direct object manipulation - no checkout required.
 * For batch operations, prefer writeFilesToMain.
 */
export async function writeFileToMain(
  gitBucket: string,
  filePath: string,
  content: string,
  commitMessage?: string,
): Promise<void> {
  const message = commitMessage || `Update ${path.basename(filePath)}`;
  await writeFilesToMain(gitBucket, [{ path: filePath, content }], message);
}

/**
 * Delete a single file from main branch.
 * Uses direct object manipulation - no checkout required.
 * For batch operations, prefer deleteFilesFromMain.
 */
export async function deleteFileFromMain(
  gitBucket: string,
  filePath: string,
  commitMessage?: string,
): Promise<void> {
  const message = commitMessage || `Delete ${path.basename(filePath)}`;
  await deleteFilesFromMain(gitBucket, [filePath], message);
}

/**
 * Rename a file on the main branch.
 * Uses direct object manipulation - no checkout required.
 * Concurrent renames are serialized to prevent race conditions.
 */
export async function renameFileOnMain(
  gitBucket: string,
  oldPath: string,
  newPath: string,
  commitMessage?: string,
): Promise<void> {
  return withWriteLock(gitBucket, "main", async () => {
    // Read the file content first
    const content = await readFileFromBranch(gitBucket, "main", oldPath);
    if (content === null) {
      throw new Error(`File not found: ${oldPath}`);
    }

    const message =
      commitMessage ||
      `Rename ${path.basename(oldPath)} to ${path.basename(newPath)}`;

    // Use commitChangesToRef to do both operations in one commit
    const changes: FileChange[] = [
      { path: oldPath, type: "delete" },
      { path: newPath, content, type: "add" },
    ];
    await commitChangesToRef(gitBucket, "main", changes, message);
  });
}

/**
 * Ensure a directory exists on the main branch (used during pull operations)
 * Uses direct object manipulation - no checkout required.
 */
export async function ensureDirOnMain(
  gitBucket: string,
  dirPath: string,
): Promise<void> {
  // Check if .gitkeep already exists in the directory on main
  const gitkeepPath = path.join(dirPath, ".gitkeep");
  const exists = await fileExistsOnMain(gitBucket, gitkeepPath);

  if (!exists) {
    // Create .gitkeep file to track the directory
    await writeFilesToMain(
      gitBucket,
      [{ path: gitkeepPath, content: "" }],
      `Create directory ${dirPath}`,
    );
  }
}

/**
 * List files from the main branch (used during pull to check existing files)
 * Uses direct object manipulation - no checkout required.
 */
export async function listFilesFromMain(
  gitBucket: string,
  dirPath: string,
): Promise<Array<{ name: string; type: "file" | "directory" }>> {
  const files = await listFilesFromBranch(gitBucket, "main", dirPath);
  return files.map((f) => ({
    name: f.name,
    type: f.type,
  }));
}

/**
 * Write a single file to a user's dirty branch and commit.
 * Uses direct object manipulation - no checkout required.
 * For batch operations, prefer writeFilesToDirtyBranch.
 */
export async function writeFileToDirtyBranch(
  gitBucket: string,
  userId: string,
  filePath: string,
  content: string,
  commitMessage?: string,
): Promise<void> {
  const message = commitMessage || `Update ${path.basename(filePath)}`;
  await writeFilesToDirtyBranch(
    gitBucket,
    userId,
    [{ path: filePath, content }],
    message,
  );
}

/**
 * List files in a directory from a specific branch (without affecting working directory)
 */
export async function listFilesFromBranch(
  gitBucket: string,
  branchName: string,
  dirPath: string,
): Promise<GitFile[]> {
  const dir = getRepoPath(gitBucket);
  const files: GitFile[] = [];

  try {
    const commitOid = await git.resolveRef({ fs, dir, ref: branchName });

    // Use git.walk to read files from the tree at dirPath
    await git.walk({
      fs,
      dir,
      trees: [git.TREE({ ref: commitOid })],
      map: async (filepath, [entry]) => {
        if (!entry) return;

        // Check if file is in the target directory (direct child only)
        if (!filepath.startsWith(`${dirPath}/`)) return;
        const relativePath = filepath.slice(dirPath.length + 1);
        // Skip if it's in a subdirectory or hidden
        if (relativePath.includes("/") || relativePath.startsWith(".")) return;

        const type = await entry.type();
        if (type === "blob") {
          files.push({
            name: relativePath,
            path: filepath,
            type: "file",
          });
        } else if (type === "tree") {
          files.push({
            name: relativePath,
            path: filepath,
            type: "directory",
          });
        }
        return undefined;
      },
    });

    return files.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  } catch {
    return [];
  }
}

/**
 * Delete a single file from a user's dirty branch.
 * Uses direct object manipulation - no checkout required.
 * For batch operations, prefer deleteFilesFromDirtyBranch.
 */
export async function deleteFileFromDirtyBranch(
  gitBucket: string,
  userId: string,
  filePath: string,
  commitMessage?: string,
): Promise<void> {
  const message = commitMessage || `Delete ${path.basename(filePath)}`;
  await deleteFilesFromDirtyBranch(gitBucket, userId, [filePath], message);
}

/**
 * Rename a file on the user's dirty branch.
 * Uses direct object manipulation - no checkout required.
 */
export async function renameFileOnDirtyBranch(
  gitBucket: string,
  userId: string,
  oldPath: string,
  newPath: string,
  commitMessage?: string,
): Promise<void> {
  const branchName = getDirtyBranchName(userId);

  // Read the file content first
  const content = await readFileFromBranch(gitBucket, branchName, oldPath);
  if (content === null) {
    throw new Error(`File not found: ${oldPath}`);
  }

  const message =
    commitMessage ||
    `Rename ${path.basename(oldPath)} to ${path.basename(newPath)}`;

  // Ensure dirty branch exists
  await ensureDirtyBranchExists(gitBucket, userId);

  // Use commitChangesToRef to do both operations in one commit
  const changes: FileChange[] = [
    { path: oldPath, type: "delete" },
    { path: newPath, content, type: "add" },
  ];
  await commitChangesToRef(gitBucket, branchName, changes, message);
}

/**
 * Get the diff content for a file between main and dirty branch
 */
export async function getFileDiff(
  gitBucket: string,
  userId: string,
  filePath: string,
): Promise<{ main: string | null; dirty: string | null } | null> {
  const dir = getRepoPath(gitBucket);
  const branchName = getDirtyBranchName(userId);

  // Check if dirty branch exists
  if (!(await branchExists(gitBucket, branchName))) {
    return null;
  }

  // Get both commit SHAs
  const [mainCommit, dirtyCommit] = await Promise.all([
    git.resolveRef({ fs, dir, ref: "main" }),
    git.resolveRef({ fs, dir, ref: branchName }),
  ]);

  // Read file from both branches
  let mainContent: string | null = null;
  let dirtyContent: string | null = null;

  try {
    const { blob } = await git.readBlob({
      fs,
      dir,
      oid: mainCommit,
      filepath: filePath,
    });
    mainContent = new TextDecoder().decode(blob);
  } catch {
    // File doesn't exist in main
  }

  try {
    const { blob } = await git.readBlob({
      fs,
      dir,
      oid: dirtyCommit,
      filepath: filePath,
    });
    dirtyContent = new TextDecoder().decode(blob);
  } catch {
    // File doesn't exist in dirty branch
  }

  // If neither exists, return null
  if (mainContent === null && dirtyContent === null) {
    return null;
  }

  return { main: mainContent, dirty: dirtyContent };
}
