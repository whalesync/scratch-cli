\> **Note:** This document describes the Git-as-backend architecture used in our 'Mackerel' prototype, where the `master` branch serves as the canonical data source (mirroring the last-fetched remote state). We are implementing a version of this model in the current project, though specific APIs and implementation details may differ.

# Git Design: Direct Object Manipulation

This document explains the git architecture in Scratch and why we use direct object manipulation instead of checkout-based writes.

## The Problem with Checkout-Based Writes

Git operations traditionally work by:

1. Checking out a branch (updating the working directory)
2. Modifying files in the working directory
3. Staging and committing changes

This approach has a critical flaw: **it depends on hidden "current branch" state**.

### Example of the Bug

Consider this sequence:

1. `resetDirtyBranchToMain()` runs and leaves `dirty/user123` checked out
2. A pull endpoint calls `writeFile()` intending to write to main
3. `writeFile()` writes to whatever branch is currently checked out - `dirty/user123`!
4. User now has dirty files they didn't create

This exact bug was found in the folder pull endpoint, causing 11 "dirty" files to appear after a sync that should have left the repo clean.

## The Solution: Direct Object Manipulation

Instead of using the working directory, we manipulate git objects directly:

1. **Read the current tree** from the target branch
2. **Create new blob objects** for file contents
3. **Build a new tree** with the updated entries
4. **Create a commit** pointing to the new tree
5. **Update the branch ref** to point to the new commit

This approach:

- Never uses `git.checkout()`
- Never depends on "current branch" state
- Explicitly specifies the target branch for every write
- Is atomic and safe

## API Design

### Core Function

```typescript
commitChangesToRef(
  gitBucket: string,
  ref: string,           // e.g., "main" or "dirty/user123"
  changes: FileChange[], // Files to add, modify, or delete
  message: string,
): Promise<string>       // Returns new commit SHA
```

### Convenience Wrappers

For main branch:

- `writeFilesToMain(gitBucket, files, message)` - batch write
- `writeFileToMain(gitBucket, path, content, message)` - single file
- `deleteFilesFromMain(gitBucket, paths, message)` - batch delete
- `deleteFileFromMain(gitBucket, path, message)` - single file
- `renameFileOnMain(gitBucket, oldPath, newPath, message)`

For dirty branches:

- `writeFilesToDirtyBranch(gitBucket, userId, files, message)` - batch write
- `writeFileToDirtyBranch(gitBucket, userId, path, content, message)` - single file
- `deleteFilesFromDirtyBranch(gitBucket, userId, paths, message)` - batch delete
- `deleteFileFromDirtyBranch(gitBucket, userId, path, message)` - single file
- `renameFileOnDirtyBranch(gitBucket, userId, oldPath, newPath, message)`

### Read Functions

For reading files (branch-explicit):

- `readFileFromBranch(gitBucket, branchName, path)` - read from specific branch
- `readFileFromMain(gitBucket, path)` - read from main
- `readFileFromDirtyBranch(gitBucket, userId, path)` - read from dirty (falls back to main)
- `fileExistsOnBranch(gitBucket, branchName, path)` - check existence on branch
- `fileExistsOnMain(gitBucket, path)` - check existence on main
- `fileExistsOnDirtyBranch(gitBucket, userId, path)` - check on dirty (falls back to main)
- `listFilesFromBranch(gitBucket, branchName, dirPath)` - list files from branch
- `listFilesFromMain(gitBucket, dirPath)` - list files from main
- `listFilesFromDirtyBranch(gitBucket, userId, dirPath)` - list from dirty (falls back to main)

### Removed Functions

The following functions have been **removed** because they operated on "whatever branch is checked out" which led to data corruption bugs:

- `writeFile()` - Use `writeFileToMain()` or `writeFileToDirtyBranch()`
- `deleteFile()` - Use `deleteFileFromMain()` or `deleteFileFromDirtyBranch()`
- `renameFile()` - Use `renameFileOnMain()` or `renameFileOnDirtyBranch()`
- `readFile()` - Use `readFileFromMain()` or `readFileFromDirtyBranch()`
- `listFiles()` - Use `listFilesFromMain()` or `listFilesFromDirtyBranch()`
- `fileExists()` - Use `fileExistsOnMain()` or `fileExistsOnDirtyBranch()`
- `getFileStats()` - Git doesn't track file stats; calculate size from content if needed

## When to Use Which Function

### Writing to Main Branch

Use main branch writes for:

- Pull operations (fetching data from external services)
- Scratch folder edits (local-only folders without external connections)

```typescript
// Pull operation - write fresh data to main
await writeFileToMain(gitBucket, filePath, content, "Pull: Update record");

// Batch pull - more efficient
await writeFilesToMain(gitBucket, files, "Pull: Update 10 records");
```

### Writing to Dirty Branch

Use dirty branch writes for:

- Sync operations (copying data between folders before publish)
- User edits in external folders (Airtable, Webflow, etc.)

```typescript
// Sync operation
await writeFileToDirtyBranch(
  gitBucket,
  userId,
  filePath,
  content,
  "Sync: Update record",
);

// User edit in external folder
await writeFileToDirtyBranch(
  gitBucket,
  userId,
  filePath,
  content,
  "Edit: Update record",
);
```

## Batch Operations

Prefer batch operations when modifying multiple files:

```typescript
// Bad - 100 separate commits
for (const file of files) {
  await writeFileToMain(gitBucket, file.path, file.content, message);
}

// Good - 1 commit with all changes
await writeFilesToMain(gitBucket, files, "Pull: Update 100 records");
```

## Reading Files

All read operations are now branch-explicit, following the same pattern as write operations. This eliminates dependency on working directory state.

### Branch Selection Logic

When deciding which branch to read from:

- **Pull operations**: Always read from `main` (source of truth from external services)
- **Publish operations**: Always read from `main` (to check existing state)
- **File API for external folders**: Read from dirty branch (user's unpublished edits)
- **File API for scratch folders**: Read from `main` (no dirty branch concept)

### Dirty Branch Fallback

Dirty branch read functions (`readFileFromDirtyBranch`, `fileExistsOnDirtyBranch`, `listFilesFromDirtyBranch`) automatically fall back to main if the dirty branch doesn't exist yet. This handles the case where a user hasn't made any edits.

```typescript
// External folder - read from dirty to show user's unpublished edits
const file = await readFileFromDirtyBranch(gitBucket, userId, filePath);

// Scratch folder - read from main
const file = await readFileFromMain(gitBucket, filePath);

// Explicit branch read when you know exactly which branch
const mainContent = await readFileFromBranch(gitBucket, "main", filePath);
```

## Technical Details

### How Tree Manipulation Works

Git stores files as:

- **Blobs**: Raw file content (just bytes)
- **Trees**: Directory listings (name → blob SHA or subtree SHA)
- **Commits**: Snapshot (tree SHA + parent commits + metadata)

To modify a file at `folder/subfolder/file.json`:

1. Create new blob with file content → get blob SHA
2. Read current `subfolder` tree, update entry for `file.json` → write new tree → get tree SHA
3. Read current `folder` tree, update entry for `subfolder` → write new tree → get tree SHA
4. Read root tree, update entry for `folder` → write new tree → get root tree SHA
5. Create commit with new root tree
6. Update branch ref to new commit

This is handled automatically by `applyChangesToTree()` in git.ts.

### Performance Considerations

Direct object manipulation is:

- **Slightly slower** for single-file operations (more git object reads/writes)
- **Much faster** for batch operations (one commit instead of N commits)
- **Safer** because it eliminates state-dependent bugs

Always prefer batch operations when modifying multiple files.

## Rebasing with 3-Way Merge

When a user has unpublished edits on their dirty branch and new data is pulled from an external service, we need to "rebase" - incorporate both the user's edits and the fresh pulled data.

### The Problem

Consider an Airtable record stored as JSON:

```json
{
  "id": "rec123",
  "Name": "Test Record",
  "Description": "Original description",
  "Image": [{ "url": "https://airtable.com/expires-in-2-hours/abc123" }]
}
```

1. User edits the "Description" field → saved to dirty branch
2. 2 hours pass, image URL expires
3. Pull fetches fresh data from Airtable → new image URL written to main
4. **Without 3-way merge**: User's entire file overwrites main, losing the fresh URL
5. **With 3-way merge**: User's Description change AND fresh URL are both preserved

### How 3-Way Merge Works

We use the classic `diff3` algorithm with three versions:

- **Base**: The file at the merge-base commit (where dirty branched from main)
- **Ours**: The user's version (from dirty branch)
- **Theirs**: The upstream version (from new main after pull)

The algorithm:

1. Compute which lines changed between base → ours (user's actual edits)
2. Compute which lines changed between base → theirs (upstream changes)
3. Merge non-overlapping changes automatically
4. For overlapping changes (same lines modified): **user's version wins**

### Conflict-Free Guarantee

The merge is **guaranteed conflict-free** because user edits always win for overlapping changes. This ensures:

- Users never see merge conflict markers
- User intent is always preserved
- We maximize preservation of upstream changes (fresh URLs, etc.)

### Implementation

```typescript
// In rebaseDirtyBranchOntoMain():

// For each modified file, perform 3-way merge
const baseContent = await readFileFromCommit(gitBucket, mergeBase, path);
const oursContent = await readFileFromBranch(gitBucket, dirtyBranch, path);
const theirsContent = await readFileFromBranch(gitBucket, "main", path);

const mergedContent = mergeFileContents(
  baseContent,
  oursContent,
  theirsContent,
);
```

### When 3-Way Merge is Used

| Scenario                    | Merge Strategy                      |
| --------------------------- | ----------------------------------- |
| User modified existing file | 3-way merge (base + ours + theirs)  |
| User added new file         | Use user's content (no base exists) |
| User deleted file           | Delete from dirty branch            |
| File only changed on main   | Main's version is kept              |

### Helper Functions

- `readFileFromCommit(gitBucket, commitOid, path)` - Read file at specific commit
- `mergeFileContents(base, ours, theirs)` - Perform 3-way line-level merge

### Limitations

**Adjacent line changes**: The diff3 algorithm works at the line level. When changes from user and pull are on adjacent lines (within the same "region"), they're treated as a single conflict and user's version wins for the entire region.

For example, in a simple flat JSON object:

```json
{
  "name": "Test", // User changes this
  "url": "old-url" // Pull changes this
}
```

Both changes are adjacent, so user's version of both lines wins (the fresh URL is lost).

However, in realistic Airtable records where the image URL is in a nested array:

```json
{
  "Description": "User edit", // User changes this
  "Status": "Active",
  "Image": [
    { "url": "fresh-url" } // Pull changes this (far from Description)
  ]
}
```

These changes are not adjacent, so both are preserved correctly.

**Future improvement**: For more precise JSON merging, we could implement field-level merge that parses JSON and merges at the object key level instead of line level.

## Pending Changes: Merge-Base Semantics

"Pending changes" (dirty files) represent the user's unpublished edits. We compute this by comparing the dirty branch to its **merge-base with main**, not to main directly.

### Why Merge-Base?

The naive approach would be: `pending changes = diff(main, dirty)`

But this breaks during a pull operation:

```
Timeline:
1. dirty branch is at commit A (same as main)
2. Pull starts - main moves to B, then C, then D...
3. User checks pending changes mid-pull
4. dirty is still at A, main is at D
5. diff(main, dirty) shows ALL pulled content as "pending"!
```

The user sees thousands of phantom "pending changes" that aren't their edits.

### The Solution

```
pending changes = diff(merge-base(main, dirty), dirty)
```

The merge-base is the commit where the dirty branch diverged from main. Comparing dirty to this point shows exactly what the user changed, regardless of where main is now.

```
Commit graph during pull:

main:   A --- B --- C --- D  (pull in progress)
         \
dirty:    A  (user's branch, no edits yet)

merge-base(main, dirty) = A
diff(A, dirty) = empty ✓  (correct - user made no edits)
diff(D, dirty) = all pulled content ✗  (wrong - shows phantom changes)
```

### Behavior by Scenario

| Scenario                    | Merge-Base      | Pending Changes     |
| --------------------------- | --------------- | ------------------- |
| No edits, no pull           | main HEAD       | Empty               |
| No edits, during pull       | Old main commit | Empty ✓             |
| User has edits, no pull     | main HEAD       | User's edits        |
| User has edits, during pull | Old main commit | User's edits only ✓ |
| After rebase completes      | New main HEAD   | User's edits        |

### Implementation

```typescript
// In getDirtyFiles():
const mergeBaseOids = await git.findMergeBase({
  fs,
  dir,
  oids: [mainCommit, dirtyCommit],
});

if (mergeBaseOids.length === 0) {
  return []; // No common ancestor (shouldn't happen)
}

// Compare dirty to merge-base, not to main
return compareCommits(gitBucket, mergeBaseOids[0], dirtyCommit);
```

This is the same merge-base logic already used in `rebaseDirtyBranchOntoMain()`.

### Consumers

All code that calls `getDirtyFiles()` benefits from this semantic:

- **`/dirty` endpoint**: Shows correct count during pulls
- **`publish.ts`**: Only publishes user's actual edits
- **`/download` endpoint**: Correctly identifies changed files
- **`hasDirtyFiles()`**: Inherits correct behavior
