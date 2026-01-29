import { GitService } from "./lib/GitService";
import * as net from "net";
import * as readline from "readline";

const checkPort = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
};

const pause = (message: string = "Hit enter to continue...") => {
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

async function runTest() {
  console.log("Checking services...");
  const apiUp = await checkPort(3100);
  const backendUp = await checkPort(3101);

  if (!apiUp || !backendUp) {
    console.error(
      `Services not running: API(3100)=${apiUp}, Backend(3101)=${backendUp}`,
    );
    process.exit(1);
  }
  console.log("Services are up.");

  const service = new GitService();
  const repoId = "test-repo-" + Date.now();
  console.log(`Starting test for ${repoId}`);

  try {
    // 1. Init

    console.log("Initializing repo...");
    await service.initRepo(repoId);
    await pause("Repo initialized. Hit enter to continue...");

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
    await pause("Files created in main. Hit enter to continue...");

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
    await pause("User edits applied to dirty. Hit enter to continue...");

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
    await pause(
      "Main branch updated (files changed/deleted). Hit enter to continue...",
    );

    // 5. Rebase dirty
    console.log("Rebasing dirty on main...");
    const result = await service.rebaseDirty(repoId);
    console.log("Rebase result:", result);
    await pause("Rebase completed. Hit enter to verify results...");

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

    await pause(
      "Verification complete. Hit enter to cleanup (or ctrl-c to keep repo)...",
    );
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    // Cleanup
    // await service.deleteRepo(repoId);
  }
}

runTest();
