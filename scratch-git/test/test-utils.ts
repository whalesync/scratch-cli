import assert from 'assert';
import fs from 'fs';
import git from 'isomorphic-git';
import * as net from 'net';
import * as readline from 'readline';
import { BaseRepoService } from '../src/services/base-repo.service';
import { RepoDebugService } from '../src/services/repo-debug.service';
import { RepoManageService } from '../src/services/repo-manage.service';
import { RepoWriteService } from '../src/services/repo-write.service';

// Adapter to match the old GitService API for tests
export class TestGitService {
  getRepoPath(repoId: string): string {
    return new BaseRepoService(repoId).getRepoPath();
  }

  async initRepo(repoId: string): Promise<void> {
    return new RepoManageService(repoId).initRepo();
  }

  async commitFiles(
    repoId: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<void> {
    return new RepoWriteService(repoId).commitFiles(branch, files, message);
  }

  async deleteFiles(repoId: string, branch: string, filePaths: string[], message: string): Promise<void> {
    return new RepoWriteService(repoId).deleteFiles(branch, filePaths, message);
  }

  async rebaseDirty(
    repoId: string,
    strategy: 'ours' | 'diff3' = 'diff3',
  ): Promise<{ rebased: boolean; conflicts: string[] }> {
    return new RepoWriteService(repoId).rebaseDirty(strategy);
  }

  async getLog(repoId: string, ref: string, depth?: number): Promise<Array<{ oid: string; parent: string[] }>> {
    return new RepoDebugService(repoId).getLog(ref, depth);
  }

  async getFile(repoId: string, branch: string, filePath: string): Promise<string | null> {
    return new BaseRepoService(repoId).getFileContent(branch, filePath);
  }

  async getRefOid(repoId: string, ref: string): Promise<string | null> {
    const service = new BaseRepoService(repoId);
    // accessing protected method via cast or we can implement it here
    // simpler to implement here using isomorphic-git directly since BaseRepoService.resolveRef is protected
    const dir = service.getRepoPath();
    try {
      return await git.resolveRef({ fs, dir, gitdir: dir, ref });
    } catch {
      return null;
    }
  }

  async deleteRepo(repoId: string): Promise<void> {
    return new RepoManageService(repoId).deleteRepo();
  }
}

export const checkPort = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
};

export const pause = (message: string = 'Hit enter to continue...') => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise<void>((resolve) => {
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
};

// --- Visualization Helpers ---

export const printGitGraph = async (service: TestGitService, repoId: string) => {
  try {
    const mainLog = await service.getLog(repoId, 'main', 20);
    const dirtyLog = await service.getLog(repoId, 'dirty', 20);

    // Map OIDs to symbols
    // Top line = main
    // Bottom line = dirty divergence
    // We reverse logs to print from oldest to newest (left to right)

    // Find merge base / common ancestor index
    // Since getLog returns recent-first, we need to handle this carefuly.
    // Let's just collect all unique commits.

    const mainOids = mainLog.map((c) => c.oid).reverse();
    const dirtyOids = dirtyLog.map((c) => c.oid).reverse();

    // Check if dirty matches main
    const mainHead = mainOids[mainOids.length - 1];
    const dirtyHead = dirtyOids[dirtyOids.length - 1];

    if (mainHead === dirtyHead) {
      // Linear history
      // ( ) - ( ) - (MD)
      const graph = mainOids
        .map((oid, idx) => {
          const isHead = idx === mainOids.length - 1;
          return isHead ? '(MD)' : '( )';
        })
        .join(' - ');
      console.log('\n' + graph + '\n');
      return;
    }

    // Divergence
    // Find last common commit
    let commonIdx = 0;
    while (
      commonIdx < mainOids.length &&
      commonIdx < dirtyOids.length &&
      mainOids[commonIdx] === dirtyOids[commonIdx]
    ) {
      commonIdx++;
    }
    // commonIdx is the first index where they DIFFER.
    // So commonIdx - 1 is the last shared commit.
    const splitPointIdx = commonIdx - 1;

    if (splitPointIdx < 0) {
      // Completely disjoint? Unlikely in this test.
      console.log('Disjoint history?');
      return;
    }

    // Main Line: Shared ... -> Split -> MainRest -> (M)
    const sharedPart = mainOids.slice(0, splitPointIdx + 1);
    const mainRest = mainOids.slice(splitPointIdx + 1);
    const dirtyRest = dirtyOids.slice(splitPointIdx + 1);

    // Render Shared part - logic adjusted for (M)/(D) labeling
    const sharedStr = sharedPart
      .map((_, idx) => {
        const isLast = idx === sharedPart.length - 1;
        if (isLast) {
          if (mainRest.length === 0) return '(M)';
          if (dirtyRest.length === 0) return '(D)';
        }
        return '( )';
      })
      .join(' - ');

    // Render Main Tail
    const mainTailStr = mainRest.map((_, idx) => (idx === mainRest.length - 1 ? '(M)' : '( )')).join(' - ');

    // Render Dirty Tail
    const dirtyTailStr = dirtyRest.map((_, idx) => (idx === dirtyRest.length - 1 ? '(D)' : '( )')).join(' - ');

    // Pad space for divergence line

    const line1Prefix = sharedStr ? sharedStr + (mainRest.length > 0 ? ' - ' : '') : '';
    const line1 = line1Prefix + mainTailStr;

    console.log('\n' + line1);

    if (dirtyRest.length > 0) {
      const branchPadding = ' '.repeat(sharedStr.length + 1);
      const line2 = branchPadding + '\\ ' + dirtyTailStr;
      console.log(line2 + '\n');
    } else {
      console.log(''); // No dirty divergence
    }
  } catch (e) {
    console.log('Error visualizing graph:', e);
  }
};

export const checkRepoState = async (
  service: TestGitService,
  repoId: string,
  stepName: string,
  expected: {
    mainRefExists?: boolean;
    dirtyRefExists?: boolean;
    dirtyAheadOfMain?: boolean; // If true, dirty != main. If false, dirty == main
    filesInMain?: Record<string, string | null>; // content or null for deleted
    filesInDirty?: Record<string, string | null>;
  },
) => {
  const repoPath = service.getRepoPath(repoId);
  const repoFiles = await fs.promises.readdir(repoPath);
  const mdFiles = repoFiles.filter((f) => f.endsWith('.md'));
  if (mdFiles.length > 0) {
    console.error('Found leaked files in bare repo:', mdFiles);
  }
  assert.strictEqual(mdFiles.length, 0, 'Bare repo should not contain working tree files');

  const mainOid = await service.getRefOid(repoId, 'main');
  const dirtyOid = await service.getRefOid(repoId, 'dirty');

  if (expected.mainRefExists !== undefined) {
    assert.strictEqual(!!mainOid, expected.mainRefExists, `Main ref existence mismatch`);
  }
  if (expected.dirtyRefExists !== undefined) {
    assert.strictEqual(!!dirtyOid, expected.dirtyRefExists, `Dirty ref existence mismatch`);
  }

  if (expected.dirtyAheadOfMain !== undefined) {
    if (expected.dirtyAheadOfMain) {
      assert.notStrictEqual(mainOid, dirtyOid, 'Dirty should be ahead of main (different OIDs)');
    } else {
      assert.strictEqual(mainOid, dirtyOid, 'Dirty should be same as main');
    }
  }

  console.log('main:');
  if (expected.filesInMain) {
    for (const [file, content] of Object.entries(expected.filesInMain)) {
      const actual = await service.getFile(repoId, 'main', file);
      assert.strictEqual(actual, content, `Main: File ${file} content mismatch`);
      if (actual !== null) {
        console.log(`${file}: ${actual}`);
      }
    }
  }

  console.log('dirty:');
  if (expected.filesInDirty) {
    for (const [file, content] of Object.entries(expected.filesInDirty)) {
      const actual = await service.getFile(repoId, 'dirty', file);
      assert.strictEqual(actual, content, `Dirty: File ${file} content mismatch`);
      if (actual !== null) {
        console.log(`${file}: ${actual}`);
      }
    }
  }

  await printGitGraph(service, repoId);
};
