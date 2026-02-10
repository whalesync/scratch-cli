import { checkPort, checkRepoState, TestGitService as GitService, pause } from './test-utils';

// TODO: Consider converting this to a proper test suite

async function runTest() {
  console.log('Checking services...');
  const apiUp = await checkPort(3100);
  const backendUp = await checkPort(3101);

  if (!apiUp) {
    console.error(`API not running: API(3100)=${apiUp}`);
    // process.exit(1);
  }
  if (!backendUp) {
    console.warn(`Backend(3101) not running. Git clone instructions won't work.`);
  }
  console.log('Services are up.');

  const service = new GitService();
  const repoId = 'test-repo-' + Date.now();
  console.log(`\nTo inspect this repo locally:`);
  console.log(`git clone http://localhost:3101/${repoId}.git`);
  console.log(`cursor ./${repoId}.git`);
  console.log(`\nStarting test for ${repoId}\n`);

  try {
    // 1. Init
    console.log('--------------------');
    console.log('Step 1: Init');
    await service.initRepo(repoId);

    await checkRepoState(service, repoId, 'Init', {
      mainRefExists: true,
      dirtyRefExists: true,
      dirtyAheadOfMain: false,
    });

    await pause();
    console.log('--------------------');

    // 2. Download (Create files in main)
    console.log('Step 2: Download (Creating files 1, 2, 3 in main)');
    await service.commitFiles(
      repoId,
      'main',
      [
        { path: 'file1.md', content: 'v1' },
        { path: 'file2.md', content: 'v2' }, // Changed to v2
        { path: 'file3.md', content: 'v3' }, // Changed to v3
      ],
      'Download files',
    );
    await service.rebaseDirty(repoId);

    await checkRepoState(service, repoId, 'Download', {
      dirtyAheadOfMain: false,
      filesInMain: {
        'file1.md': 'v1',
        'file2.md': 'v2',
        'file3.md': 'v3',
      },
      filesInDirty: {
        'file1.md': 'v1',
        'file2.md': 'v2',
        'file3.md': 'v3',
      },
    });

    await pause();
    console.log('--------------------');

    // 3. User edits on dirty
    console.log('Step 3: Edit (Dirty changes: mod file1, del file2, mod file3, add file4)');
    await service.commitFiles(
      repoId,
      'dirty',
      [
        { path: 'file1.md', content: 'v1.1' },
        { path: 'file3.md', content: 'v3.1' }, // from v3 -> v3.1
        { path: 'file4.md', content: 'v4' },
      ],
      'User edits',
    );
    await service.deleteFiles(repoId, 'dirty', ['file2.md'], 'User deletes file2');

    await checkRepoState(service, repoId, 'Edit', {
      dirtyAheadOfMain: true,
      filesInMain: {
        'file1.md': 'v1',
        'file2.md': 'v2',
        'file3.md': 'v3',
      },
      filesInDirty: {
        'file1.md': 'v1.1',
        'file2.md': null,
        'file3.md': 'v3.1',
        'file4.md': 'v4',
      },
    });

    await pause();
    console.log('--------------------');

    // 4. Pull (Main updates + Rebase)
    console.log('Step 4: Pull (Main changes: mod file1, mod file2, del file3, add file5)');
    await service.commitFiles(
      repoId,
      'main',
      [
        { path: 'file1.md', content: 'v1.2' },
        { path: 'file2.md', content: 'v2.1' }, // from v2 -> v2.1
        { path: 'file5.md', content: 'v5' },
      ],
      'Remote updates',
    );
    await service.deleteFiles(repoId, 'main', ['file3.md'], 'Remote delete file3');

    console.log('Rebasing dirty on main...');
    const result = await service.rebaseDirty(repoId);
    console.log('Rebase result:', result);

    await checkRepoState(service, repoId, 'Pull', {
      dirtyAheadOfMain: true,
      filesInMain: {
        'file1.md': 'v1.2',
        'file2.md': 'v2.1',
        'file3.md': null,
        'file5.md': 'v5',
      },
      filesInDirty: {
        'file1.md': 'v1.1',
        'file2.md': null,
        'file3.md': 'v3.1',
        'file4.md': 'v4',
        'file5.md': 'v5',
      },
    });

    await pause();
    console.log('--------------------');

    // 5. Publish Deletes
    console.log('Step 5: Publish Deletes');
    await service.deleteFiles(repoId, 'main', ['file2.md'], 'Publish delete file2');
    await service.rebaseDirty(repoId);

    await checkRepoState(service, repoId, 'Publish Deletes', {
      dirtyAheadOfMain: true,
      filesInMain: {
        'file2.md': null,
      },
      filesInDirty: {
        'file2.md': null,
        'file1.md': 'v1.1',
        'file3.md': 'v3.1',
        'file4.md': 'v4',
        'file5.md': 'v5',
      },
    });

    await pause();
    console.log('--------------------');

    // 6. Publish Non-delete Changes
    console.log('Step 6: Publish Non-delete Changes');
    await service.commitFiles(
      repoId,
      'main',
      [
        { path: 'file1.md', content: 'v1.1' },
        { path: 'file3.md', content: 'v3.1' },
        { path: 'file4.md', content: 'v4' },
      ],
      'Publish changes',
    );
    await service.rebaseDirty(repoId);

    await checkRepoState(service, repoId, 'Publish Changes', {
      dirtyAheadOfMain: false,
      filesInMain: {
        'file1.md': 'v1.1',
        'file2.md': null,
        'file3.md': 'v3.1',
        'file4.md': 'v4',
        'file5.md': 'v5',
      },
      filesInDirty: {
        'file1.md': 'v1.1',
        'file2.md': null,
        'file3.md': 'v3.1',
        'file4.md': 'v4',
        'file5.md': 'v5',
      },
    });

    console.log('Test Completed Successfully!');

    await pause();
    console.log('--------------------');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    // Cleanup
    // await service.deleteRepo(repoId);
  }
}

void runTest();
