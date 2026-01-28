import { GitService } from "./lib/GitService";
import fs from "fs";
import path from "path";

async function debug() {
  const service = new GitService();
  const repoId = "debug-repo-" + Date.now();
  console.log(`Creating repo ${repoId}`);

  await service.initRepo(repoId);

  const dir = service.getRepoPath(repoId);
  console.log(`Repo path: ${dir}`);

  const files = fs.readdirSync(dir);
  console.log("Files in repo:", files);

  // Check refs
  const refsDir = path.join(dir, "refs", "heads");
  if (fs.existsSync(refsDir)) {
    console.log("Refs/heads:", fs.readdirSync(refsDir));
  } else {
    console.log("No refs/heads directory!");
  }
}

debug().catch(console.error);
