import os from 'node:os';
import path from 'node:path';
import { DIRTY_BRANCH, MAIN_BRANCH } from '../../../lib/constants';
import { TestGitService } from '../../../test/test-utils';
import { RepoCheckpointService } from '../repo-checkpoint.service';
import { RepoManageService } from '../repo-manage.service';
import { RepoWriteService } from '../repo-write.service';

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
// createCheckpoint / listCheckpoints
// ---------------------------------------------------------------------------
describe('createCheckpoint', () => {
  it('creates a checkpoint that appears in listCheckpoints', async () => {
    const cp = new RepoCheckpointService(repoId);
    await cp.createCheckpoint('v1');

    const list = await cp.listCheckpoints();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('v1');
  });

  it('preserves the commit message in the checkpoint', async () => {
    const writer = new RepoWriteService(repoId);
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'x' }], 'my commit message');
    await writer.rebaseDirty();

    const cp = new RepoCheckpointService(repoId);
    await cp.createCheckpoint('snap');

    const list = await cp.listCheckpoints();
    expect(list[0].message).toContain('my commit message');
  });

  it('creates multiple checkpoints', async () => {
    const writer = new RepoWriteService(repoId);
    const cp = new RepoCheckpointService(repoId);

    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'v1' }], 'first');
    await writer.rebaseDirty();
    await cp.createCheckpoint('cp1');

    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'v2' }], 'second');
    await writer.rebaseDirty();
    await cp.createCheckpoint('cp2');

    const list = await cp.listCheckpoints();
    const names = list.map((c) => c.name).sort();
    expect(names).toEqual(['cp1', 'cp2']);
  });
});

// ---------------------------------------------------------------------------
// revertToCheckpoint
// ---------------------------------------------------------------------------
describe('revertToCheckpoint', () => {
  it('restores main and dirty to checkpointed state', async () => {
    const writer = new RepoWriteService(repoId);
    const cp = new RepoCheckpointService(repoId);

    // Create initial state and checkpoint
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'v1' }], 'v1');
    await writer.rebaseDirty();
    await cp.createCheckpoint('snap');

    // Advance past checkpoint
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'v2' }], 'v2');
    await writer.rebaseDirty();
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'f.md')).toBe('v2');

    // Revert
    await cp.revertToCheckpoint('snap');

    expect(await helper.getFile(repoId, MAIN_BRANCH, 'f.md')).toBe('v1');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'f.md')).toBe('v1');
  });

  it('restores dirty branch with user edits from checkpoint', async () => {
    const writer = new RepoWriteService(repoId);
    const cp = new RepoCheckpointService(repoId);

    // Seed main, then make dirty edits
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'main-v1' }], 'seed');
    await writer.rebaseDirty();
    await writer.commitFiles(DIRTY_BRANCH, [{ path: 'f.md', content: 'dirty-edit' }], 'user edit');
    await cp.createCheckpoint('with-edits');

    // Advance and overwrite everything
    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'main-v2' }], 'advance');
    await writer.rebaseDirty();

    // Revert — dirty should have the user edit back
    await cp.revertToCheckpoint('with-edits');
    expect(await helper.getFile(repoId, MAIN_BRANCH, 'f.md')).toBe('main-v1');
    expect(await helper.getFile(repoId, DIRTY_BRANCH, 'f.md')).toBe('dirty-edit');
  });

  it('throws for non-existent checkpoint', async () => {
    const cp = new RepoCheckpointService(repoId);
    await expect(cp.revertToCheckpoint('nonexistent')).rejects.toThrow('Checkpoint nonexistent not found');
  });
});

// ---------------------------------------------------------------------------
// deleteCheckpoint
// ---------------------------------------------------------------------------
describe('deleteCheckpoint', () => {
  it('removes checkpoint from list', async () => {
    const cp = new RepoCheckpointService(repoId);
    await cp.createCheckpoint('temp');
    expect(await cp.listCheckpoints()).toHaveLength(1);

    await cp.deleteCheckpoint('temp');
    expect(await cp.listCheckpoints()).toHaveLength(0);
  });

  it('does not throw when deleting non-existent checkpoint', async () => {
    const cp = new RepoCheckpointService(repoId);
    await expect(cp.deleteCheckpoint('nope')).resolves.toBeUndefined();
  });

  it('does not affect other checkpoints', async () => {
    const writer = new RepoWriteService(repoId);
    const cp = new RepoCheckpointService(repoId);

    await writer.commitFiles(MAIN_BRANCH, [{ path: 'f.md', content: 'v1' }], 'v1');
    await writer.rebaseDirty();
    await cp.createCheckpoint('keep');
    await cp.createCheckpoint('remove');

    await cp.deleteCheckpoint('remove');

    const list = await cp.listCheckpoints();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('keep');
  });
});
