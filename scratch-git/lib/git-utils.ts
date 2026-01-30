import git from 'isomorphic-git';
import fs from 'node:fs';
import path from 'node:path';

// Base directory for git repos (local development)
const REPOS_BASE_DIR = process.env.GIT_REPOS_DIR || '.scratch-repos';

// Default author for commits
const DEFAULT_AUTHOR = { name: 'Scratch', email: 'scratch@example.com' };

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
  type: 'add' | 'modify' | 'delete';
}

// =============================================================================
// DIRECT OBJECT MANIPULATION - CORE FUNCTIONS
// =============================================================================

/**
 * Tree entry as returned by isomorphic-git's readTree
 */
interface TreeEntry {
  mode: string;
  path: string;
  oid: string;
  type: 'blob' | 'tree' | 'commit';
}

/**
 * Get the filesystem path for a workspace's git repo
 */
export function getRepoPath(gitBucket: string): string {
  return path.join(process.cwd(), REPOS_BASE_DIR, gitBucket);
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
  const parentCommit = await git.resolveRef({ fs, dir, gitdir: dir, ref });

  // Get the current tree from that commit
  const { tree: currentTree } = await git.readTree({ fs, dir, gitdir: dir, oid: parentCommit });

  // Apply changes to build the new tree
  const newTreeOid = await applyChangesToTree(
    dir,
    currentTree,
    changes,
    '', // root path prefix
  );

  // Create commit pointing to new tree
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

  // Update the ref to point to new commit
  await git.writeRef({ fs, dir, gitdir: dir, ref: `refs/heads/${ref}`, value: newCommit, force: true });

  return newCommit;
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
    const relativePath = pathPrefix ? change.path.slice(pathPrefix.length + 1) : change.path;

    const slashIndex = relativePath.indexOf('/');
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
      if (directChange.type === 'delete') {
        // Skip this entry (delete it)
        continue;
      }
      // Replace with new content
      const newBlobOid = await git.writeBlob({ fs, dir, gitdir: dir, blob: Buffer.from(directChange.content || '') });
      newEntries.push({
        mode: '100644',
        path: entry.path,
        oid: newBlobOid,
        type: 'blob',
      });
    } else if (subtreeChange && entry.type === 'tree') {
      // Recursively process subtree
      const { tree: subtreeEntries } = await git.readTree({ fs, dir, gitdir: dir, oid: entry.oid });
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
        type: 'tree',
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
    if ((change.type === 'add' || change.type === 'modify') && !currentEntries.some((e) => e.path === change.path)) {
      const newBlobOid = await git.writeBlob({ fs, dir, gitdir: dir, blob: Buffer.from(change.content || '') });
      newEntries.push({
        mode: '100644',
        path: change.path,
        oid: newBlobOid,
        type: 'blob',
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
        mode: '040000',
        path: subtreeName,
        oid: newSubtreeOid,
        type: 'tree',
      });
    }
  }

  // Sort entries (git requires sorted tree entries)
  newEntries.sort((a, b) => {
    // Git sorts directories with a trailing slash for comparison purposes
    const aName = a.type === 'tree' ? `${a.path}/` : a.path;
    const bName = b.type === 'tree' ? `${b.path}/` : b.path;
    return aName.localeCompare(bName);
  });

  // Write the new tree
  const newTreeOid = await git.writeTree({ fs, dir, gitdir: dir, tree: newEntries });

  return newTreeOid;
}

/**
 * Initialize a git repository for a workspace
 */
export async function initRepo(gitBucket: string): Promise<void> {
  const dir = getRepoPath(gitBucket);

  // Create directory if it doesn't exist
  await fs.promises.mkdir(dir, { recursive: true });

  // Check if HEAD exists (has initial commit)
  try {
    await git.resolveRef({ fs, dir, gitdir: dir, ref: 'HEAD' });
    return; // Already initialized with commits
  } catch {
    // HEAD doesn't exist, proceed to init if needed
  }

  // Check if config exists to determine if it's already a repo
  const configPath = path.join(dir, 'config');
  const gitDir = path.join(dir, '.git');

  // If neither bare config nor .git dir exists, initialize
  if (!fs.existsSync(configPath) && !fs.existsSync(gitDir)) {
    // Explicitly set gitdir to dir to ensure it doesn't create a .git subdirectory
    console.log('Running git.init with gitdir=dir');
    await git.init({ fs, dir, gitdir: dir, defaultBranch: 'main', bare: true });
  }

  // Create initial commit with empty .gitkeep
  // Since it's a bare repo, we can't use git.add/git.commit easily with workdir file
  // We'll construct the tree and commit manually

  // 1. Create blob for .gitkeep
  const blobOid = await git.writeBlob({ fs, dir, gitdir: dir, blob: Buffer.from('') });

  // 2. Create tree containing .gitkeep
  const treeOid = await git.writeTree({
    fs,
    dir,
    gitdir: dir,
    tree: [
      {
        mode: '100644',
        path: '.gitkeep',
        oid: blobOid,
        type: 'blob',
      },
    ],
  });

  // 3. Create initial commit
  const commitOid = await git.writeCommit({
    fs,
    dir,
    gitdir: dir,
    commit: {
      tree: treeOid,
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

  // 4. Update HEAD to point to main
  await git.writeRef({ fs, dir, gitdir: dir, ref: 'refs/heads/main', value: commitOid, force: true });
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
 * Check if a branch exists
 */
export async function branchExists(gitBucket: string, branchName: string): Promise<boolean> {
  const dir = getRepoPath(gitBucket);
  try {
    await git.resolveRef({ fs, dir, gitdir: dir, ref: branchName });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a dirty branch for a user, branching from main
 * If the branch already exists, this does nothing
 */
export async function createDirtyBranch(gitBucket: string, userId: string): Promise<void> {
  const dir = getRepoPath(gitBucket);
  const branchName = getDirtyBranchName(userId);

  // Check if branch already exists
  if (await branchExists(gitBucket, branchName)) {
    return;
  }

  // Create the new branch pointing to main's current commit
  const mainCommit = await git.resolveRef({ fs, dir, gitdir: dir, ref: 'main' });
  await git.branch({ fs, dir, gitdir: dir, ref: branchName, object: mainCommit });
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
    const commitOid = await git.resolveRef({ fs, dir, gitdir: dir, ref: branchName });
    const { blob } = await git.readBlob({ fs, dir, gitdir: dir, oid: commitOid, filepath: filePath });
    return new TextDecoder().decode(blob);
  } catch {
    return null;
  }
}
