import { GitService } from "../lib/GitService";
import assert from "assert";

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTest() {
  const repoId = "test-checkpoints-" + Date.now();
  const gitService = new GitService();

  console.log(`Initialized repo ${repoId}`);
  await gitService.initRepo(repoId);

  // 1. Setup initial state
  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "file1.txt", content: "v1" }],
    "Initial commit",
  );
  await gitService.rebaseDirty(repoId);

  // 2. Create Checkpoint "start"
  console.log("Creating checkpoint 'start'");
  await gitService.createCheckpoint(repoId, "start");
  const checkpoints1 = await gitService.listCheckpoints(repoId);
  assert(checkpoints1.includes("start"), "Checkpoint start should exist");

  // 3. Make changes
  console.log("Modifying files...");
  // Dirty: Change file1 to v2-dirty
  await gitService.commitFiles(
    repoId,
    "dirty",
    [{ path: "file1.txt", content: "v2-dirty" }],
    "Dirty change",
  );
  // Main: Change file1 to v2-main
  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "file1.txt", content: "v2-main" }],
    "Main change",
  );

  // 4. Create Checkpoint "changed"
  console.log("Creating checkpoint 'changed'");
  await gitService.createCheckpoint(repoId, "changed");
  const checkpoints2 = await gitService.listCheckpoints(repoId);
  assert(checkpoints2.includes("start"), "Checkpoint start should still exist");
  assert(checkpoints2.includes("changed"), "Checkpoint changed should exist");

  // 5. Test Revert to "start"
  console.log("Reverting to 'start'...");
  await gitService.revertToCheckpoint(repoId, "start");

  const file1Start = await gitService.getFile(repoId, "dirty", "file1.txt");
  assert.strictEqual(file1Start, "v1", "Should revert dirty to v1");
  const listAfterRevert = await gitService.listCheckpoints(repoId);
  assert(listAfterRevert.length === 2, "Revert should not delete checkpoints"); // "changed" still exists as a tag/ref

  // 6. Test Revert to "changed"
  console.log("Reverting to 'changed'...");
  await gitService.revertToCheckpoint(repoId, "changed");
  const file1Changed = await gitService.getFile(repoId, "dirty", "file1.txt");
  assert.strictEqual(
    file1Changed,
    "v2-dirty",
    "Should revert dirty to v2-dirty",
  );

  // 7. Verify Merge Strategies
  console.log("Testing merge strategies...");
  // Current state: main=v2-main, dirty=v2-dirty.
  // Base (common ancestor, from 'start') was v1.

  // 7a. Default Strategy (ours)
  console.log("-> Rebase with strategy 'ours' (default)");
  await gitService.rebaseDirty(repoId, "ours");
  const file1Ours = await gitService.getFile(repoId, "dirty", "file1.txt");
  assert.strictEqual(
    file1Ours,
    "v2-dirty",
    "Ours strategy should keep dirty version",
  );

  // 7b. Diff3 Strategy
  // Setup a 3-way merge scenario that can be merged cleanly or conflicts.
  // v1: A\nB\nC
  // Main: A\nB2\nC
  // Dirty: A\nB\nC2
  // Merged: A\nB2\nC2

  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "merge.txt", content: "A\nB\nC" }],
    "Setup merge base",
  );
  await gitService.rebaseDirty(repoId); // Sync dirty to main
  await gitService.createCheckpoint(repoId, "merge-base");

  // Main edit
  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "merge.txt", content: "A\nB2\nC" }],
    "Main edit B->B2",
  );
  // Dirty edit (start from base)
  await gitService.revertToCheckpoint(repoId, "merge-base"); // ensure dirty is at base
  // Wait, if I revert checkpoint, I move HEAD. I need to commit on top of that.
  await gitService.commitFiles(
    repoId,
    "dirty",
    [{ path: "merge.txt", content: "A\nB\nC2" }],
    "Dirty edit C->C2",
  );
  // Important: dirty and main must share history.
  // Current state might be diverged.
  // Checkpoint revert resets hard.
  // "main" is at merge-base now (from revert).
  // So I need to set main forward again.
  // Actually, let's just create new state.

  await gitService.deleteRepo(repoId);
  await gitService.initRepo(repoId);
  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "conflict.txt", content: "Base" }],
    "Init",
  );
  await gitService.rebaseDirty(repoId); // sync
  await gitService.createCheckpoint(repoId, "base");

  // Main moves
  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "conflict.txt", content: "Main" }],
    "Main moves",
  );

  // Dirty moves (from base)
  await gitService.revertToCheckpoint(repoId, "base"); // Reset both to base
  // We need main to stay at "Main moves".
  // Checkpoint reverts BOTH.
  // So:
  // 1. Revert to base.
  // 2. Commit to Dirty -> "Dirty"
  // 3. Move Main -> "Main" (we lost the previous main commit ref unless we stored it, but we can just recreate it)
  await gitService.commitFiles(
    repoId,
    "dirty",
    [{ path: "conflict.txt", content: "Dirty" }],
    "Dirty moves",
  );
  // Now move main again (diverge)
  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "conflict.txt", content: "Main" }],
    "Main moves (re-applied)",
  );

  // Now we have:
  //         /-> Main (content "Main")
  // Base ->
  //         \-> Dirty (content "Dirty")
  // Conflict expected.

  // Strategy OURS
  console.log("-> Testing conflict with 'ours'");
  await gitService.rebaseDirty(repoId, "ours");
  const contentOurs = await gitService.getFile(repoId, "dirty", "conflict.txt");
  assert.strictEqual(contentOurs, "Dirty", "Ours should win conflict");

  // Strategy DIFF3
  // Reset condition
  // We rebased, so dirty is now on top of main (with "Dirty" content).
  // To test diff3, we need to recreate the divergence.
  // This is hard to do cleanly without better git control in test.
  // Let's trust the unit test of mergeFileContents?
  // Or:
  // Base: A
  // Main: A\nB
  // Dirty: A\nC
  // Merge: A\nB\nC (if separate lines)
  // Let's try separate lines.

  await gitService.deleteRepo(repoId);
  await gitService.initRepo(repoId);
  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "lines.txt", content: "A\n\n\nD" }],
    "Base",
  );
  await gitService.rebaseDirty(repoId);
  await gitService.createCheckpoint(repoId, "base-lines");

  // Main adds B
  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "lines.txt", content: "A\nB\n\nD" }],
    "Main adds B",
  );

  // Dirty adds C at different lines
  await gitService.revertToCheckpoint(repoId, "base-lines");
  await gitService.commitFiles(
    repoId,
    "dirty",
    [{ path: "lines.txt", content: "A\n\nC\nD" }],
    "Dirty adds C",
  );
  // Main ref is lost by revert, recreate divergence
  await gitService.commitFiles(
    repoId,
    "main",
    [{ path: "lines.txt", content: "A\nB\n\nD" }],
    "Main adds B (again)",
  );

  console.log("-> Testing clean 3-way merge with 'diff3'");
  const result = await gitService.rebaseDirty(repoId, "diff3");
  const mergedContent = await gitService.getFile(repoId, "dirty", "lines.txt");

  // Expect A, B, C, D (merged)
  // Note: diff3 typically handles non-overlapping insertions well.
  // If it fails, it might be conflict.
  console.log("Merged content:", JSON.stringify(mergedContent));
  assert(mergedContent?.includes("B"), "Should include Main change B");
  assert(mergedContent?.includes("C"), "Should include Dirty change C");

  // 8. Delete Checkpoint
  console.log("Deleting checkpoint 'start'");
  await gitService.deleteCheckpoint(repoId, "start");
  const listFinal = await gitService.listCheckpoints(repoId);
  assert(!listFinal.includes("start"), "Start checkpoint should be gone");

  console.log("Cleaning up...");
  await gitService.deleteRepo(repoId);
  console.log("Test Passed!");
}

runTest().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
