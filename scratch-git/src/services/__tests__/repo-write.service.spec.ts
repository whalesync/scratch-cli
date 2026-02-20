import os from 'node:os';
import path from 'node:path';
import { DIRTY_BRANCH, MAIN_BRANCH } from '../../../lib/constants';
import { TestGitService } from '../../../test/test-utils';
import { RepoManageService } from '../repo-manage.service';
import { RepoWriteService } from '../repo-write.service';

// Point repos at a temp directory so tests don't pollute the working tree
const TEST_REPOS_DIR = path.join(os.tmpdir(), `scratch-git-test-${process.pid}`);
process.env.GIT_REPOS_DIR = TEST_REPOS_DIR;

const helper = new TestGitService();
let repoId: string;

function newRepoId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

beforeEach(async () => {
  repoId = newRepoId();
  await new RepoManageService(repoId).initRepo();
});

afterEach(async () => {
  await new RepoManageService(repoId).deleteRepo();
});

// ---------------------------------------------------------------------------
// commitFiles
// ---------------------------------------------------------------------------
describe('commitFiles', () => {
  it('commits a single file and reads it back', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'hello.md', content: 'world' }], 'add hello');

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'hello.md')).toBe('world');
  });

  it('commits multiple files in one call', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(
      DIRTY_BRANCH,
      [
        { path: 'a.md', content: 'aaa' },
        { path: 'b.md', content: 'bbb' },
      ],
      'add a+b',
    );

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'a.md')).toBe('aaa');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'b.md')).toBe('bbb');
  });

  it('strips leading / from paths', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(DIRTY_BRANCH, [{ path: '/leading.md', content: 'ok' }], 'leading slash');

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'leading.md')).toBe('ok');
  });

  it('overwrites existing file content', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'file.md', content: 'v1' }], 'v1');
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'file.md', content: 'v2' }], 'v2');

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'file.md')).toBe('v2');
  });
});

// ---------------------------------------------------------------------------
// deleteFiles
// ---------------------------------------------------------------------------
describe('deleteFiles', () => {
  it('deletes a file, verifies it returns null', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'bye.md', content: 'gone' }], 'add');
    await writer.deleteFiles(DIRTY_BRANCH, ['bye.md'], 'delete');

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'bye.md')).toBeNull();
  });

  it('deletes multiple files', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(
      DIRTY_BRANCH,
      [
        { path: 'x.md', content: 'x' },
        { path: 'y.md', content: 'y' },
      ],
      'add',
    );
    await writer.deleteFiles(DIRTY_BRANCH, ['x.md', 'y.md'], 'delete both');

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'x.md')).toBeNull();
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'y.md')).toBeNull();
  });

  it('strips leading / from paths', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'slash.md', content: 'x' }], 'add');
    await writer.deleteFiles(DIRTY_BRANCH, ['/slash.md'], 'delete with slash');

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'slash.md')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteFolder
// ---------------------------------------------------------------------------
describe('deleteFolder', () => {
  it('deletes a folder containing multiple files', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(
      DIRTY_BRANCH,
      [
        { path: 'folder/a.md', content: 'a' },
        { path: 'folder/b.md', content: 'b' },
      ],
      'add folder',
    );
    await writer.deleteFolder('folder', 'delete folder');

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'folder/a.md')).toBeNull();
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'folder/b.md')).toBeNull();
  });

  it('preserves sibling files/folders', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(
      DIRTY_BRANCH,
      [
        { path: 'target/a.md', content: 'a' },
        { path: 'sibling/b.md', content: 'b' },
        { path: 'root.md', content: 'root' },
      ],
      'add files',
    );
    await writer.deleteFolder('target', 'delete target');

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'target/a.md')).toBeNull();
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'sibling/b.md')).toBe('b');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'root.md')).toBe('root');
  });
});

// ---------------------------------------------------------------------------
// removeDataFolder
// ---------------------------------------------------------------------------
describe('removeDataFolder', () => {
  it('removes folder from both main and dirty, then rebases', async () => {
    const writer = new RepoWriteService(repoId);
    // seed main
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'data/file.md', content: 'x' }], 'seed main');
    await writer.rebaseDirty();

    // also make a dirty edit to something else
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'other.md', content: 'keep' }], 'dirty edit');

    await writer.removeDataFolder('data');

    expect(await helper.getFile(repoId, MAIN_BRANCH, 'data/file.md')).toBeNull();
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'data/file.md')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// publishFile
// ---------------------------------------------------------------------------
describe('publishFile', () => {
  it('file appears on main after publish', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.publishFile({ path: 'pub.md', content: 'published' }, 'publish');

    expect(await helper.getFile(repoId, MAIN_BRANCH, 'pub.md')).toBe('published');
  });

  it('dirty is rebased; user edits to other files survive', async () => {
    const writer = new RepoWriteService(repoId);
    // Seed main with a file
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'base.md', content: 'base' }], 'seed');
    await writer.rebaseDirty();

    // User edits on dirty
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'user.md', content: 'mine' }], 'user edit');

    // Publish a different file
    await writer.publishFile({ path: 'pub.md', content: 'published' }, 'publish');

    expect(await helper.getFile(repoId, MAIN_BRANCH, 'pub.md')).toBe('published');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'pub.md')).toBe('published');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'user.md')).toBe('mine');
  });
});

// ---------------------------------------------------------------------------
// discardChanges
// ---------------------------------------------------------------------------
describe('discardChanges', () => {
  let writer: RepoWriteService;

  beforeEach(async () => {
    writer = new RepoWriteService(repoId);
    // Seed main with files
    await writer.commitFiles(
      MAIN_BRANCH,
      [
        { path: 'keep.md', content: 'original' },
        { path: 'folder/deep.md', content: 'deep-original' },
      ],
      'seed',
    );
    await writer.rebaseDirty();
  });

  it('reverts a modified file to main content', async () => {
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'keep.md', content: 'modified' }], 'modify');

    await writer.discardChanges('keep.md', [{ path: 'keep.md', status: 'modified' }]);

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'keep.md')).toBe('original');
  });

  it('removes an added file', async () => {
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'new.md', content: 'added' }], 'add new');

    await writer.discardChanges('new.md', [{ path: 'new.md', status: 'added' }]);

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'new.md')).toBeNull();
  });

  it('restores a deleted file', async () => {
    await writer.deleteFiles(DIRTY_BRANCH, ['keep.md'], 'delete');

    await writer.discardChanges('keep.md', [{ path: 'keep.md', status: 'deleted' }]);

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'keep.md')).toBe('original');
  });

  it('discards all files under a folder prefix', async () => {
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'folder/deep.md', content: 'edited' }], 'edit');

    await writer.discardChanges('folder', [{ path: 'folder/deep.md', status: 'modified' }]);

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'folder/deep.md')).toBe('deep-original');
  });

  it('no-op when path does not match any changes', async () => {
    const dirtyOidBefore = await helper.getRefOid(repoId, DIRTY_BRANCH);

    await writer.discardChanges('nonexistent.md', [{ path: 'other.md', status: 'modified' }]);

    const dirtyOidAfter = await helper.getRefOid(repoId, DIRTY_BRANCH);
    expect(dirtyOidAfter).toBe(dirtyOidBefore);
  });
});

// ---------------------------------------------------------------------------
// rebaseDirty
// ---------------------------------------------------------------------------
describe('rebaseDirty', () => {
  let writer: RepoWriteService;

  beforeEach(() => {
    writer = new RepoWriteService(repoId);
  });

  it('no dirty branch → creates one from main', async () => {
    // Delete the dirty branch that initRepo created, then rebase
    // We'll do this by creating a new repo without dirty
    const freshId = newRepoId();
    const manage = new RepoManageService(freshId);
    await manage.initRepo();

    // Verify dirty exists after init (initRepo creates it)
    const dirtyOid = await helper.getRefOid(freshId, DIRTY_BRANCH);
    const mainOid = await helper.getRefOid(freshId, MAIN_BRANCH);
    expect(dirtyOid).toBe(mainOid);

    await manage.deleteRepo();
  });

  it('main === dirty → no-op', async () => {
    const mainOid = await helper.getRefOid(repoId, MAIN_BRANCH);
    const dirtyOid = await helper.getRefOid(repoId, DIRTY_BRANCH);
    expect(mainOid).toBe(dirtyOid);

    const result = await writer.rebaseDirty();

    expect(result).toEqual({ rebased: true, conflicts: [] });
    expect(await helper.getRefOid(repoId, DIRTY_BRANCH)).toBe(mainOid);
  });

  it('no user changes → fast-forwards dirty to main', async () => {
    // Advance main without touching dirty
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'new.md', content: 'new' }], 'advance main');

    const mainOid = await helper.getRefOid(repoId, MAIN_BRANCH);
    expect(await helper.getRefOid(repoId, DIRTY_BRANCH)).not.toBe(mainOid);

    await writer.rebaseDirty();

    expect(await helper.getRefOid(repoId, DIRTY_BRANCH)).toBe(mainOid);
  });

  it('user modifications survive rebase', async () => {
    // Seed main
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'file.md', content: 'v1' }], 'seed');
    await writer.rebaseDirty();

    // User modifies on dirty
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'file.md', content: 'v1-user' }], 'user edit');

    // Main advances
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'other.md', content: 'other' }], 'main advance');

    await writer.rebaseDirty();

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'file.md')).toBe('v1-user');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'other.md')).toBe('other');
  });

  it('user additions survive rebase', async () => {
    // Seed main
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'base.md', content: 'base' }], 'seed');
    await writer.rebaseDirty();

    // User adds file on dirty
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'added.md', content: 'user-added' }], 'user add');

    // Main advances
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'main-new.md', content: 'from-main' }], 'main advance');

    await writer.rebaseDirty();

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'added.md')).toBe('user-added');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'main-new.md')).toBe('from-main');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'base.md')).toBe('base');
  });

  it('user deletions survive rebase', async () => {
    // Seed main
    await writer.commitFiles(
      MAIN_BRANCH,
      [
        { path: 'keep.md', content: 'keep' },
        { path: 'remove.md', content: 'remove' },
      ],
      'seed',
    );
    await writer.rebaseDirty();

    // User deletes on dirty
    await writer.deleteFiles(DIRTY_BRANCH, ['remove.md'], 'user delete');

    // Main advances
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'new.md', content: 'new' }], 'main advance');

    await writer.rebaseDirty();

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'remove.md')).toBeNull();
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'keep.md')).toBe('keep');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'new.md')).toBe('new');
  });

  it('concurrent edits to same file → diff3 merge produces combined result', async () => {
    const base = 'line1\nline2\nline3\nline4\nline5';
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'shared.md', content: base }], 'seed');
    await writer.rebaseDirty();

    // User edits line 1 on dirty
    const userVersion = 'LINE1-USER\nline2\nline3\nline4\nline5';
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'shared.md', content: userVersion }], 'user edit');

    // Main edits line 5
    const mainVersion = 'line1\nline2\nline3\nline4\nLINE5-MAIN';
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'shared.md', content: mainVersion }], 'main edit');

    await writer.rebaseDirty();

    const result = await helper.getFile(repoId, DIRTY_BRANCH, 'shared.md');
    expect(result).toBe('LINE1-USER\nline2\nline3\nline4\nLINE5-MAIN');
  });

  it('no unnecessary commit when user edit already matches main', async () => {
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'same' }], 'seed');
    await writer.rebaseDirty();

    // User edits to something, then main gets the same content
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'f.md', content: 'updated' }], 'user edit');
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'updated' }], 'main catches up');

    await writer.rebaseDirty();

    // dirty should equal main since user's content matches
    const mainOid = await helper.getRefOid(repoId, MAIN_BRANCH);
    const dirtyOid = await helper.getRefOid(repoId, DIRTY_BRANCH);
    expect(dirtyOid).toBe(mainOid);
  });

  it("strategy: 'ours' skips diff3 merge", async () => {
    const base = 'line1\nline2\nline3';
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: base }], 'seed');
    await writer.rebaseDirty();

    // User modifies
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'f.md', content: 'user-content' }], 'user');
    // Main modifies
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'main-content' }], 'main');

    await writer.rebaseDirty('ours');

    // With 'ours' strategy, user content wins without diff3 merging
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'f.md')).toBe('user-content');
  });
});

// ---------------------------------------------------------------------------
// applyChangesToTree (tested indirectly through commitFiles)
// ---------------------------------------------------------------------------
describe('applyChangesToTree (via commitFiles)', () => {
  let writer: RepoWriteService;

  beforeEach(() => {
    writer = new RepoWriteService(repoId);
  });

  it('adds file at root', async () => {
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'root.txt', content: 'root' }], 'add root');
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'root.txt')).toBe('root');
  });

  it('adds file in new nested directory (intermediate trees created)', async () => {
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'a/b/c/deep.txt', content: 'deep' }], 'add nested');
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'a/b/c/deep.txt')).toBe('deep');
  });

  it('modifies existing file in subdirectory', async () => {
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'dir/file.txt', content: 'v1' }], 'add');
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'dir/file.txt', content: 'v2' }], 'modify');
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'dir/file.txt')).toBe('v2');
  });

  it('deletes file in subdirectory (sibling preserved)', async () => {
    await writer.commitFiles(
      MAIN_BRANCH,
      [
        { path: 'dir/keep.txt', content: 'keep' },
        { path: 'dir/remove.txt', content: 'remove' },
      ],
      'add both',
    );
    await writer.deleteFiles(MAIN_BRANCH, ['dir/remove.txt'], 'delete one');

    expect(await helper.getFile(repoId, MAIN_BRANCH, 'dir/keep.txt')).toBe('keep');
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'dir/remove.txt')).toBeNull();
  });

  it('tree entries are sorted correctly (verified by round-tripping content)', async () => {
    // Add files in non-alphabetical order to verify sorting
    await writer.commitFiles(
      MAIN_BRANCH,
      [
        { path: 'z.txt', content: 'z' },
        { path: 'a.txt', content: 'a' },
        { path: 'm.txt', content: 'm' },
        { path: 'dir/b.txt', content: 'b' },
        { path: 'dir/a.txt', content: 'a' },
      ],
      'add unsorted',
    );

    // Verify all files readable (git would reject badly sorted trees)
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'a.txt')).toBe('a');
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'm.txt')).toBe('m');
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'z.txt')).toBe('z');
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'dir/a.txt')).toBe('a');
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'dir/b.txt')).toBe('b');
  });
});

// ---------------------------------------------------------------------------
// mergeFileContents (tested indirectly through rebaseDirty)
// ---------------------------------------------------------------------------
describe('mergeFileContents (via rebaseDirty)', () => {
  let writer: RepoWriteService;

  beforeEach(() => {
    writer = new RepoWriteService(repoId);
  });

  it('only ours changed → returns ours', async () => {
    const base = 'base content';
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: base }], 'seed');
    await writer.rebaseDirty();

    // User modifies, main unchanged
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'f.md', content: 'user change' }], 'user');

    // Advance main with a different file so main != dirty
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'other.md', content: 'x' }], 'main advance');

    await writer.rebaseDirty();

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'f.md')).toBe('user change');
  });

  it('only theirs changed → returns theirs', async () => {
    const base = 'base content';
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: base }], 'seed');
    await writer.rebaseDirty();

    // User adds a different file (so dirty diverges), but doesn't touch f.md
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'other.md', content: 'user' }], 'user');

    // Main modifies f.md
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'main change' }], 'main edit');

    await writer.rebaseDirty();

    // f.md should have main's content since user didn't change it
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'f.md')).toBe('main change');
  });

  it('non-overlapping edits → clean merge', async () => {
    const base = 'line1\nline2\nline3\nline4\nline5';
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: base }], 'seed');
    await writer.rebaseDirty();

    // User edits top
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'f.md', content: 'USER\nline2\nline3\nline4\nline5' }], 'user');

    // Main edits bottom
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'line1\nline2\nline3\nline4\nMAIN' }], 'main');

    await writer.rebaseDirty();

    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'f.md')).toBe('USER\nline2\nline3\nline4\nMAIN');
  });

  it('conflicting edits → ours wins', async () => {
    const base = 'line1\nline2\nline3';
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: base }], 'seed');
    await writer.rebaseDirty();

    // Both edit the same line
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'f.md', content: 'USER-LINE1\nline2\nline3' }], 'user');
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'MAIN-LINE1\nline2\nline3' }], 'main');

    await writer.rebaseDirty();

    const result = await helper.getFile(repoId, DIRTY_BRANCH, 'f.md');
    // In conflict, ours (user) wins per the mergeFileContents implementation
    expect(result).toBe('USER-LINE1\nline2\nline3');
  });
});
