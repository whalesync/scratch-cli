/* eslint-disable @typescript-eslint/no-misused-promises */
import cors from 'cors';
import express from 'express';
import { GitService } from './lib/GitService';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const port = process.env.PORT || 3100;
const gitService = new GitService();

app.post('/api/repo/:id/init', async (req, res) => {
  try {
    await gitService.initRepo(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/repo/:id', async (req, res) => {
  try {
    await gitService.deleteRepo(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/repo/:id/rebase', async (req, res) => {
  try {
    const body = req.body as { strategy?: string };
    const strategy = body.strategy; // Expects JSON body now if strategy provided, or query? Post body usually.
    // The previous implementation didn't check body mostly.
    // Let's assume req.body.strategy for POST.
    const result = await gitService.rebaseDirty(req.params.id, strategy as 'ours' | 'diff3');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/repo/:id/status', async (req, res) => {
  try {
    const status = await gitService.getDirtyStatus(req.params.id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/repo/:id/folder-diff', async (req, res) => {
  try {
    const folder = req.query.folder as string;
    if (!folder) throw new Error('Query param folder is required');
    const files = await gitService.getFolderDirtyStatus(req.params.id, folder);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/repo/:id/diff', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) throw new Error('Query param path is required');
    const diff = await gitService.getFileDiff(req.params.id, filePath);
    res.json(diff);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/repo/:id/list', async (req, res) => {
  try {
    const branch = (req.query.branch as string) || 'main'; // default to main
    const folder = (req.query.folder as string) || '';
    const files = await gitService.list(req.params.id, branch, folder);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/repo/:id/file', async (req, res) => {
  try {
    const branch = (req.query.branch as string) || 'main';
    const path = req.query.path as string;
    if (!path) throw new Error('Query param path is required');
    const content = await gitService.getFile(req.params.id, branch, path);
    if (content === null) return res.status(404).json({ error: 'File not found' });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/repo/:id/files', async (req, res) => {
  try {
    const branch = (req.query.branch as string) || 'main';
    const { files, message } = req.body as { files: { path: string; content: string }[]; message?: string };
    await gitService.commitFiles(
      req.params.id,
      branch,
      files.map((f: { path: string; content: string }) => ({
        ...f,
        path: f.path.startsWith('/') ? f.path.slice(1) : f.path,
      })),
      message || 'Update files',
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/repo/:id/files', async (req, res) => {
  try {
    const branch = (req.query.branch as string) || 'main';
    const { files, message } = req.body as { files: string[]; message?: string }; // files is array of paths
    await gitService.deleteFiles(req.params.id, branch, files, message || 'Delete files');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/repo/:id/publish', async (req, res) => {
  try {
    const { file, message } = req.body as { file: { path: string; content: string }; message?: string };
    await gitService.publishFile(req.params.id, file, message || 'Publish file');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/repo/:id/checkpoint', async (req, res) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) throw new Error('Checkpoint name required');
    await gitService.createCheckpoint(req.params.id, name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/api/repo/:id/checkpoint/revert', async (req, res) => {
  try {
    const { name } = req.body as { name: string };
    if (!name) throw new Error('Checkpoint name required');
    await gitService.revertToCheckpoint(req.params.id, name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/repo/:id/checkpoints', async (req, res) => {
  try {
    const checkpoints = await gitService.listCheckpoints(req.params.id);
    res.json(checkpoints);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/api/repo/:id/graph', async (req, res) => {
  try {
    const graph = await gitService.getGraphData(req.params.id);
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.delete('/api/repo/:id/checkpoint/:name', async (req, res) => {
  try {
    await gitService.deleteCheckpoint(req.params.id, req.params.name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(port, () => {
  console.log(`ScratchGit API listening at http://localhost:${port}`);
});
