import { GitService } from "./lib/GitService";
import * as net from "net";
import * as readline from "readline";
import assert from "assert";

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

import fs from "fs";
import path from "path";

const checkRepoState = async (
  service: GitService,
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
  const mdFiles = repoFiles.filter((f) => f.endsWith(".md"));
  if (mdFiles.length > 0) {
    console.error("Found leaked files in bare repo:", mdFiles);
  }
  assert.strictEqual(
    mdFiles.length,
    0,
    "Bare repo should not contain working tree files",
  );

  const mainOid = await service.getRefOid(repoId, "main");
  const dirtyOid = await service.getRefOid(repoId, "dirty");

  if (expected.mainRefExists !== undefined) {
    assert.strictEqual(
      !!mainOid,
      expected.mainRefExists,
      `Main ref existence mismatch`,
    );
  }
  if (expected.dirtyRefExists !== undefined) {
    assert.strictEqual(
      !!dirtyOid,
      expected.dirtyRefExists,
      `Dirty ref existence mismatch`,
    );
  }

  if (expected.dirtyAheadOfMain !== undefined) {
    if (expected.dirtyAheadOfMain) {
      assert.notStrictEqual(
        mainOid,
        dirtyOid,
        "Dirty should be ahead of main (different OIDs)",
      );
    } else {
      assert.strictEqual(mainOid, dirtyOid, "Dirty should be same as main");
    }
  }

  console.log("main:");
  if (expected.filesInMain) {
    for (const [file, content] of Object.entries(expected.filesInMain)) {
      const actual = await service.getFile(repoId, "main", file);
      assert.strictEqual(
        actual,
        content,
        `Main: File ${file} content mismatch`,
      );
      if (actual !== null) {
        console.log(`${file}: ${actual}`);
      }
    }
  }

  console.log("dirty:");
  if (expected.filesInDirty) {
    for (const [file, content] of Object.entries(expected.filesInDirty)) {
      const actual = await service.getFile(repoId, "dirty", file);
      assert.strictEqual(
        actual,
        content,
        `Dirty: File ${file} content mismatch`,
      );
      if (actual !== null) {
        console.log(`${file}: ${actual}`);
      }
    }
  }

  await printGitGraph(service, repoId);
};

// --- Visualization Helpers ---

const printGitGraph = async (service: GitService, repoId: string) => {
  try {
    const mainLog = await service.getLog(repoId, "main", 20);
    const dirtyLog = await service.getLog(repoId, "dirty", 20);

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
          return isHead ? "(MD)" : "( )";
        })
        .join(" - ");
      console.log("\n" + graph + "\n");
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
      console.log("Disjoint history?");
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
          if (mainRest.length === 0) return "(M)";
          if (dirtyRest.length === 0) return "(D)";
        }
        return "( )";
      })
      .join(" - ");

    // Render Main Tail
    const mainTailStr = mainRest
      .map((_, idx) => (idx === mainRest.length - 1 ? "(M)" : "( )"))
      .join(" - ");

    // Render Dirty Tail
    const dirtyTailStr = dirtyRest
      .map((_, idx) => (idx === dirtyRest.length - 1 ? "(D)" : "( )"))
      .join(" - ");

    // Pad space for divergence line

    const line1Prefix = sharedStr
      ? sharedStr + (mainRest.length > 0 ? " - " : "")
      : "";
    const line1 = line1Prefix + mainTailStr;

    console.log("\n" + line1);

    if (dirtyRest.length > 0) {
      const branchPadding = " ".repeat(sharedStr.length + 1);
      const line2 = branchPadding + "\\ " + dirtyTailStr;
      console.log(line2 + "\n");
    } else {
      console.log(""); // No dirty divergence
    }
  } catch (e) {
    console.log("Error visualizing graph:", e);
  }
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
  console.log(`\nTo inspect this repo locally:`);
  console.log(`git clone http://localhost:3101/${repoId}.git`);
  console.log(`cursor ./${repoId}.git`);
  console.log(`\nStarting test for ${repoId}\n`);

  try {
    // 1. Init
    console.log("--------------------");
    console.log("Step 1: Init");
    await service.initRepo(repoId);

    await checkRepoState(service, repoId, "Init", {
      mainRefExists: true,
      dirtyRefExists: true,
      dirtyAheadOfMain: false,
    });

    await pause();
    console.log("--------------------");

    // 2. Download (Create files in main)
    console.log("Step 2: Download (Creating files 1, 2, 3 in main)");
    await service.commitFiles(
      repoId,
      "main",
      [
        { path: "file1.md", content: "v1" },
        { path: "file2.md", content: "v2" }, // Changed to v2
        { path: "file3.md", content: "v3" }, // Changed to v3
      ],
      "Download files",
    );
    await service.rebaseDirty(repoId);

    await checkRepoState(service, repoId, "Download", {
      dirtyAheadOfMain: false,
      filesInMain: {
        "file1.md": "v1",
        "file2.md": "v2",
        "file3.md": "v3",
      },
      filesInDirty: {
        "file1.md": "v1",
        "file2.md": "v2",
        "file3.md": "v3",
      },
    });

    await pause();
    console.log("--------------------");

    // 3. User edits on dirty
    console.log(
      "Step 3: Edit (Dirty changes: mod file1, del file2, mod file3, add file4)",
    );
    await service.commitFiles(
      repoId,
      "dirty",
      [
        { path: "file1.md", content: "v1.1" },
        { path: "file3.md", content: "v3.1" }, // from v3 -> v3.1
        { path: "file4.md", content: "v4" },
      ],
      "User edits",
    );
    await service.deleteFiles(
      repoId,
      "dirty",
      ["file2.md"],
      "User deletes file2",
    );

    await checkRepoState(service, repoId, "Edit", {
      dirtyAheadOfMain: true,
      filesInMain: {
        "file1.md": "v1",
        "file2.md": "v2",
        "file3.md": "v3",
      },
      filesInDirty: {
        "file1.md": "v1.1",
        "file2.md": null,
        "file3.md": "v3.1",
        "file4.md": "v4",
      },
    });

    await pause();
    console.log("--------------------");

    // 4. Pull (Main updates + Rebase)
    console.log(
      "Step 4: Pull (Main changes: mod file1, mod file2, del file3, add file5)",
    );
    await service.commitFiles(
      repoId,
      "main",
      [
        { path: "file1.md", content: "v1.2" },
        { path: "file2.md", content: "v2.1" }, // from v2 -> v2.1
        { path: "file5.md", content: "v5" },
      ],
      "Remote updates",
    );
    await service.deleteFiles(
      repoId,
      "main",
      ["file3.md"],
      "Remote delete file3",
    );

    console.log("Rebasing dirty on main...");
    const result = await service.rebaseDirty(repoId);
    console.log("Rebase result:", result);

    await checkRepoState(service, repoId, "Pull", {
      dirtyAheadOfMain: true,
      filesInMain: {
        "file1.md": "v1.2",
        "file2.md": "v2.1",
        "file3.md": null,
        "file5.md": "v5",
      },
      filesInDirty: {
        "file1.md": "v1.1",
        "file2.md": null,
        "file3.md": "v3.1",
        "file4.md": "v4",
        "file5.md": "v5",
      },
    });

    await pause();
    console.log("--------------------");

    // 5. Publish Deletes
    console.log("Step 5: Publish Deletes");
    await service.deleteFiles(
      repoId,
      "main",
      ["file2.md"],
      "Publish delete file2",
    );
    await service.rebaseDirty(repoId);

    await checkRepoState(service, repoId, "Publish Deletes", {
      dirtyAheadOfMain: true,
      filesInMain: {
        "file2.md": null,
      },
      filesInDirty: {
        "file2.md": null,
        "file1.md": "v1.1",
        "file3.md": "v3.1",
        "file4.md": "v4",
        "file5.md": "v5",
      },
    });

    await pause();
    console.log("--------------------");

    // 6. Publish Non-delete Changes
    console.log("Step 6: Publish Non-delete Changes");
    await service.commitFiles(
      repoId,
      "main",
      [
        { path: "file1.md", content: "v1.1" },
        { path: "file3.md", content: "v3.1" },
        { path: "file4.md", content: "v4" },
      ],
      "Publish changes",
    );
    await service.rebaseDirty(repoId);

    await checkRepoState(service, repoId, "Publish Changes", {
      dirtyAheadOfMain: false,
      filesInMain: {
        "file1.md": "v1.1",
        "file2.md": null,
        "file3.md": "v3.1",
        "file4.md": "v4",
        "file5.md": "v5",
      },
      filesInDirty: {
        "file1.md": "v1.1",
        "file2.md": null,
        "file3.md": "v3.1",
        "file4.md": "v4",
        "file5.md": "v5",
      },
    });

    console.log("Test Completed Successfully!");

    await pause();
    console.log("--------------------");
  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    // Cleanup
    // await service.deleteRepo(repoId);
  }
}

runTest();
