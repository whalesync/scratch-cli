import cors from "cors";
import express from "express";
import { GitService } from "./lib/GitService";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(cors());

const port = process.env.PORT || 3100;
const gitService = new GitService();

app.post("/api/repo/:id/init", async (req, res) => {
  try {
    await gitService.initRepo(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete("/api/repo/:id", async (req, res) => {
  try {
    await gitService.deleteRepo(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/repo/:id/rebase", async (req, res) => {
  try {
    const result = await gitService.rebaseDirty(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/repo/:id/status", async (req, res) => {
  try {
    const status = await gitService.getDirtyStatus(req.params.id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/repo/:id/diff", async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) throw new Error("Query param path is required");
    const diff = await gitService.getFileDiff(req.params.id, filePath);
    res.json(diff);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/repo/:id/list", async (req, res) => {
  try {
    const branch = (req.query.branch as string) || "main"; // default to main
    const folder = (req.query.folder as string) || "";
    const files = await gitService.list(req.params.id, branch, folder);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/api/repo/:id/file", async (req, res) => {
  try {
    const branch = (req.query.branch as string) || "main";
    const path = req.query.path as string;
    if (!path) throw new Error("Query param path is required");
    const content = await gitService.getFile(req.params.id, branch, path);
    if (content === null)
      return res.status(404).json({ error: "File not found" });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/api/repo/:id/files", async (req, res) => {
  try {
    const branch = (req.query.branch as string) || "main";
    const { files, message } = req.body;
    await gitService.commitFiles(
      req.params.id,
      branch,
      files,
      message || "Update files",
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete("/api/repo/:id/files", async (req, res) => {
  try {
    const branch = (req.query.branch as string) || "main";
    const { files, message } = req.body; // files is array of paths
    await gitService.deleteFiles(
      req.params.id,
      branch,
      files,
      message || "Delete files",
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

app.listen(port, () => {
  console.log(`ScratchGit API listening at http://localhost:${port}`);
});
