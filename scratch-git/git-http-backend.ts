import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { spawn } from "child_process";
import { GitService } from "./lib/GitService";

const app = express();
const port = process.env.GIT_BACKEND_PORT || 3101;
const gitService = new GitService();

app.use(cors());
// IMPORTANT: Do NOT use express.json() or body-parser here.
// It consumes streams that need to go to git-http-backend.

// Logging middleware
app.use((req, res, next) => {
  console.log(`[GIT] ${req.method} ${req.path}`);
  next();
});

// ==========================================
// Git Smart HTTP Backend (Standard Git Client)
// ==========================================
// Matches /:repo.git/info/refs, /:repo.git/git-upload-pack, etc.
app.all("/:repoId.git/*", (req, res) => {
  const repoId = req.params.repoId;
  const repoPath = gitService.getRepoPath(repoId);

  // env vars for git http-backend
  const env = Object.assign({}, process.env, {
    GIT_PROJECT_ROOT: path.dirname(repoPath), // Parent dir of repos
    GIT_HTTP_EXPORT_ALL: "1",
    PATH_INFO: req.path, // e.g. /myrepo.git/info/refs
    REMOTE_USER: "scratch-user", // Mock auth user
    QUERY_STRING: req.url.split("?")[1] || "",
    REQUEST_METHOD: req.method,
    CONTENT_TYPE: req.headers["content-type"],
  });

  // Spawn git http-backend
  const gitProc = spawn("git", ["http-backend"], { env });

  // Pipe inputs
  req.pipe(gitProc.stdin);

  // Pipe outputs with CGI header parsing
  let headersSent = false;
  let buffer = Buffer.alloc(0);

  gitProc.stdout.on("data", (chunk) => {
    if (headersSent) {
      res.write(chunk);
      return;
    }

    buffer = Buffer.concat([buffer, chunk]);

    // Look for double newline indicating end of headers
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd !== -1) {
      const headerPart = buffer.slice(0, headerEnd).toString("utf-8");
      const bodyPart = buffer.slice(headerEnd + 4);

      // Parse and set headers
      headerPart.split("\r\n").forEach((line) => {
        const [key, value] = line.split(": ");
        if (key && value) {
          res.setHeader(key, value);
        }
      });

      headersSent = true;
      res.write(bodyPart);
    }
  });

  gitProc.stderr.on("data", (data) => {
    console.error(`Git Backend Error: ${data}`);
  });

  gitProc.on("exit", (code) => {
    if (code !== 0) {
      console.error(`git http-backend exited with code ${code}`);
      if (!res.headersSent) {
        res.status(500).send("Git backend error");
      }
    } else {
      res.end();
    }
  });
});

app.listen(port, () => {
  console.log(`Scratch Git HTTP Server listening on port ${port}`);
});
