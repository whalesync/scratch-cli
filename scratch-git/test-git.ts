import { GitService } from "./lib/GitService";

async function runTest() {
  const service = new GitService();
  const repoId = "test-repo-" + Date.now();
  console.log(`Starting test for ${repoId}`);

  try {
    // 1. Init

    console.log("Initializing repo...");
    await service.initRepo(repoId);

    // 2. Create files in main
    console.log("Creating files in main...");
    await service.commitFiles(
      repoId,
      "main",
      [
        { path: "file1.txt", content: "v1" },
        { path: "file2.txt", content: "v1" },
      ],
      "Init files",
    );

    // 3. User edits on dirty (simulate user working)
    console.log("User editing on dirty...");
    // We need to ensure dirty branch exists first? initRepo does that.
    await service.commitFiles(
      repoId,
      "dirty",
      [
        { path: "file1.txt", content: "v1-edited-by-user" }, // Modify
        { path: "file3.txt", content: "user-created" }, // Add
      ],
      "User edits",
    );

    // 4. Main updates (simulate external changes/pull)
    console.log("Updating main...");
    await service.commitFiles(
      repoId,
      "main",
      [
        { path: "file1.txt", content: "v2" }, // Conflict?
        { path: "file2.txt", content: "v2" }, // No conflict, user didn't touch
        { path: "file4.txt", content: "new-in-main" },
      ],
      "Main updates",
    );

    await service.deleteFiles(
      repoId,
      "main",
      ["file2.txt"],
      "Delete file2 in main",
    );

    // 5. Rebase dirty
    console.log("Rebasing dirty on main...");
    const result = await service.rebaseDirty(repoId);
    console.log("Rebase result:", result);

    // 6. Verify result
    const dirtyFiles = await service.list(repoId, "dirty", "");
    console.log(
      "Files in dirty:",
      dirtyFiles.map((f) => f.path),
    );

    const content1 = await service.getFile(repoId, "dirty", "file1.txt");
    console.log("Content of file1.txt (should be user edit):", content1);

    const content3 = await service.getFile(repoId, "dirty", "file3.txt");
    console.log("Content of file3.txt (should remain):", content3);

    const content4 = await service.getFile(repoId, "dirty", "file4.txt");
    console.log("Content of file4.txt (should exist from main):", content4);

    // file2 should be gone
    const exists2 = await service.fileExists(repoId, "dirty", "file2.txt");
    console.log("file2.txt exists? (should be false):", exists2);
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    // Cleanup
    // await service.deleteRepo(repoId);
  }
}

runTest();
