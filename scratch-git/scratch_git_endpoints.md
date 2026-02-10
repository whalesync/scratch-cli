# Scratch Git Endpoints

This document enumerates current `scratch-git` endpoints and suggests improvements, specifically focusing on transitioning to spawned `git` processes for efficiency.

## Repository Management

POST /api/repo/:id/init
Initializes a new bare git repository.
Improvement: Use `git init --bare` process spawn to ensure standard git directory structure and hooks support.

DELETE /api/repo/:id
Deletes a repository from the filesystem.
Improvement: Use system `rm -rf` (via node `fs.rm`) which is already efficient, but ensuring no lingering processes lock files is key.

GET /api/repo/:id/exists
Checks if a repository exists.
Improvement: Continue using `fs.stat` as it is faster than spawning a git process for simple existence checks.

GET /health
Returns service health status.
Improvement: Maintain current lightweight implementation; no git process needed.

## File Operations

GET /api/repo/:id/list
Lists files in a specific branch and folder.
Improvement: Use `git ls-tree -r --name-only` to list files, which is significantly faster than walking the object tree in JS.

GET /api/repo/:id/file
Retrieves the content of a specific file.
Improvement: Use `git show <branch>:<path>` to stream file content directly, handling large files better than memory-buffered JS output.

POST /api/repo/:id/files
Commits a batch of file changes (create/update).
Improvement: Use `git update-index` and `git write-tree` plumbing commands or a temporary worktree to handle batch writes more efficiently than JS-based object writing.

DELETE /api/repo/:id/files
Deletes a batch of files.
Improvement: Use `git rm` (in a worktree) or update index directly to avoid overhead of JS tree manipulation.

DELETE /api/repo/:id/folder
Deletes a folder and its contents.
Improvement: Use `git rm -r <folder>` to leverage native recursive deletion logic.

DELETE /api/repo/:id/data-folder
Robustly removes a data folder from `main` and `dirty` branches and rebases.
Improvement: Script this as a sequence of git commands (`git push . :refs/heads/main` logic or similar index manipulations) to execute atomically.

GET /api/repo/:id/archive
Generates a ZIP archive of the repository.
Improvement: Use `git archive` command to generate the stream directly, which is highly optimized for this exact task.

POST /api/repo/:id/publish
Commits a file to `main` and syncs `dirty`.
Improvement: Use `git checkout main`, `git add`, `git commit`, then `git rebase` sequence for reliable history rewriting.

## Branch & State Management

GET /api/repo/:id/status
Gets the status of the `dirty` branch (files changed).
Improvement: Use `git status --porcelain` or `git diff --name-status` to instantly get changed files without manually comparing trees.

GET /api/repo/:id/folder-diff
Gets the status of a specific folder.
Improvement: Use `git diff --name-status <ref> -- <folder>` to filter changes natively.

GET /api/repo/:id/diff
Gets the line-by-line diff of a specific file.
Improvement: Use `git diff` to generate standard unification diffs, avoiding the need for a JS-based diff library.

POST /api/repo/:id/rebase
Rebases the `dirty` branch onto `main`.
Improvement: Use `git rebase` command, which handles conflict markers and history rewriting much more reliably than manual tree merging.

POST /api/repo/:id/reset
Resets the repo or specific files to `main`.
Improvement: Use `git reset --hard` (for full) or `git checkout <ref> -- <path>` (for files) for instant state revert.

## Checkpoints

POST /api/repo/:id/checkpoint
Creates a named checkpoint (tags).
Improvement: Use `git tag` command, which is simple and fast.

GET /api/repo/:id/checkpoints
Lists all checkpoints.
Improvement: Use `git tag --list` with format options to retrieve metadata efficiently.

POST /api/repo/:id/checkpoint/revert
Reverts state to a specific checkpoint.
Improvement: Use `git reset --hard <tag>` or `git checkout` to restore state exactly as tagged.

DELETE /api/repo/:id/checkpoint/:name
Deletes a checkpoint.
Improvement: Use `git tag -d` to remove the tags.

## Visualization

GET /api/repo/:id/graph
Returns data for the commit graph.
Improvement: Use `git log --graph --pretty=format:...` to retrieve structured history data optimized for parsing.

---

**Note:** For write operations (POST/DELETE), we plan to enable two flavors in the future:

1.  **Create new commit**: Standard behavior, adding a new commit to history.
2.  **Amend existing commit**: Modifying the tip of the branch without creating a new history node (useful for "work in progress" autosaves).
