import { RepoManageService } from '../src/services/repo-manage.service';
import { RepoWriteService } from '../src/services/repo-write.service';
import { TestGitService as GitService } from './test-utils';

let TOTAL_FILES = 1000;
let BATCH_SIZE = 100;

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '-n') {
    TOTAL_FILES = parseInt(process.argv[++i], 10);
  } else if (process.argv[i] === '-b') {
    BATCH_SIZE = parseInt(process.argv[++i], 10);
  }
}

const TOTAL_BATCHES = Math.ceil(TOTAL_FILES / BATCH_SIZE);

async function runTest() {
  console.log('Checking services...');

  const repoId = 'test-bulk-' + Date.now();
  console.log(`\nTo inspect this repo locally:`);
  console.log(`git clone http://localhost:3101/${repoId}.git`);
  console.log(`cursor ./${repoId}.git`);
  console.log(`\nStarting bulk workflow test for ${repoId}\n`);

  try {
    const manageService = new RepoManageService(repoId);
    const writeService = new RepoWriteService(repoId);
    const helper = new GitService();

    // 1. Init
    console.log('--------------------');
    console.log('Step 1: Init');
    await manageService.initRepo();

    console.log('--------------------');
    console.log(`Step 2: Pulling ${TOTAL_FILES} records into main in ${TOTAL_BATCHES} batches...`);

    console.time(`Pull ${TOTAL_FILES} records to main`);
    const folderName = 'bulk-data';
    const allFilePaths: string[] = [];

    for (let batch = 0; batch < TOTAL_BATCHES; batch++) {
      const files: { path: string; content: string }[] = [];
      for (let i = 0; i < BATCH_SIZE; i++) {
        const id = batch * BATCH_SIZE + i;
        if (id >= TOTAL_FILES) break;

        const path = `${folderName}/record_${id}.json`;
        allFilePaths.push(path);

        files.push({
          path,
          content: JSON.stringify({ id, batch, data: 'random data payload ' + Math.random() }),
        });
      }
      await writeService.commitFiles('main', files, `Pull Batch ${batch}`);
      await writeService.rebaseDirty();
      process.stdout.write('.');
    }
    console.log('');
    console.timeEnd(`Pull ${TOTAL_FILES} records to main`);

    console.log('Step 3: Rebasing dirty on main...');
    console.time('Rebase dirty');
    await writeService.rebaseDirty();
    console.timeEnd('Rebase dirty');

    const mainHead = await helper.getRefOid(repoId, 'main');
    const dirtyHead = await helper.getRefOid(repoId, 'dirty');
    console.log(`MAIN HEAD:  ${mainHead}\nDIRTY HEAD: ${dirtyHead}`);

    // await pause();
    console.log('--------------------');

    console.log('Step 4: User clicks "Delete all records" (dirty branch operation)');
    console.time('DeleteFolder on dirty');
    await writeService.deleteFolder(folderName, 'Delete all records', 'dirty');
    console.timeEnd('DeleteFolder on dirty');

    const dirtyHeadAfterDelete = await helper.getRefOid(repoId, 'dirty');
    console.log(`DIRTY HEAD after delete: ${dirtyHeadAfterDelete}`);

    // await pause();
    console.log('--------------------');

    console.log(`Step 5: Publishing deletes to main in ${TOTAL_BATCHES} batches...`);
    console.time('Publish deletes to main');

    for (let batch = 0; batch < TOTAL_BATCHES; batch++) {
      const startIdx = batch * BATCH_SIZE;
      const endIdx = startIdx + BATCH_SIZE;
      const filesToDelete = allFilePaths.slice(startIdx, endIdx);

      if (filesToDelete.length === 0) break;

      console.time(`Publish Delete Batch ${batch}`);
      await writeService.deleteFiles('main', filesToDelete, `Publish Delete Batch ${batch}`);
      console.timeEnd(`Publish Delete Batch ${batch}`);

      console.time(`Rebase dirty Batch ${batch}`);
      await writeService.rebaseDirty();
      console.timeEnd(`Rebase dirty Batch ${batch}`);
    }
    console.log('');
    console.timeEnd('Publish deletes to main');

    const finalMainHead = await helper.getRefOid(repoId, 'main');
    const finalDirtyHead = await helper.getRefOid(repoId, 'dirty');
    console.log(`Final MAIN HEAD:  ${finalMainHead}\nFinal DIRTY HEAD: ${finalDirtyHead}`);

    // await pause();
    console.log('--------------------');

    console.log('Test Completed Successfully!');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    // Cleanup
    // await manageService.deleteRepo();
  }
}

void runTest();
