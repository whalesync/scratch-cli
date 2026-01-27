import "dotenv/config";
import express from "express";
import cors from "cors";
import { GitService } from "./lib/GitService";

const app = express();
const port = process.env.PORT || 3100;
const gitService = new GitService();

app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// ==========================================
// RPC API (Stateless Operations)
// ==========================================

// Create Repo
app.post("/api/repo/create", async (req, res) => {
  try {
    const { repoId } = req.body;
    if (!repoId) {
      return res.status(400).json({ error: "repoId is required" });
    }

    await gitService.initRepo(repoId);
    res.json({ success: true, message: `Repository ${repoId} initialized.` });
  } catch (err: any) {
    console.error("Create Repo Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Read content
app.get("/api/exec/read", async (req, res) => {
  try {
    const { repoId, path: filePath, ref } = req.query;
    if (!repoId || !filePath) {
      return res.status(400).json({ error: "repoId and path are required" });
    }

    const content = await gitService.readFile(
      String(repoId),
      String(filePath),
      ref ? String(ref) : undefined,
    );

    if (content === null) {
      return res.status(404).json({ error: "File not found" });
    }

    res.send(content);
  } catch (err: any) {
    console.error("Read Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Stateless commit
app.post("/api/exec/commit", async (req, res) => {
  try {
    const { repoId, files, message, author } = req.body;
    // files: [{ path, content }]

    if (!repoId || !files || !Array.isArray(files)) {
      return res
        .status(400)
        .json({ error: "repoId and files array are required" });
    }

    await gitService.statelessCommit(repoId, files, {
      message: message || "Update from API",
      author,
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("Commit Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Create Dirty Branch (Bookmark)
app.post("/api/branch/dirty", async (req, res) => {
  try {
    const { repoId, userId } = req.body;
    if (!repoId || !userId) {
      return res.status(400).json({ error: "repoId and userId are required" });
    }

    await gitService.createDirtyBranch(repoId, userId);
    res.json({ success: true, message: `Dirty branch created for ${userId}` });
  } catch (err: any) {
    console.error("Create Branch Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Scratch API Server listening on port ${port}`);
});
