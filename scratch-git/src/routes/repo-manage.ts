/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { GitService } from '../../lib/GitService';

export const repoManageRouter = Router({ mergeParams: true });
const gitService = new GitService();

// Note: ID param is expected to be merged from parent router or handled here if path is absolute
// However, the plan is to mount this at /api/repo/manage/:id
// So req.params.id should be available if mergeParams is true.

repoManageRouter.post('/init', async (req, res) => {
  const { id: repoId } = req.params as { id: string };
  console.log(`[API] Initializing repo: ${repoId}`);
  try {
    await gitService.initRepo(repoId);
    const repoPath = gitService.getRepoPath(repoId);
    console.log(`[API] Repo initialized successfully: ${repoId} at ${repoPath}, exists: ${fs.existsSync(repoPath)}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`[API] Failed to initialize repo ${repoId}:`, err);
    res.status(500).json({ error: (err as Error).message });
  }
});

repoManageRouter.delete('/', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    await gitService.deleteRepo(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoManageRouter.get('/exists', (req, res) => {
  const { id: repoId } = req.params as { id: string };
  const repoPath = gitService.getRepoPath(repoId);
  const exists = fs.existsSync(repoPath);
  const hasHead = exists && fs.existsSync(resolve(repoPath, 'HEAD'));
  res.json({ repoId, repoPath, exists, hasHead });
});

repoManageRouter.post('/reset', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { path } = req.body as { path?: string };
    if (path) {
      await gitService.discardChanges(id, path);
    } else {
      await gitService.resetToMain(id);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoManageRouter.post('/checkpoint', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { name } = req.body as { name: string };
    if (!name) throw new Error('Checkpoint name required');
    await gitService.createCheckpoint(id, name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoManageRouter.post('/checkpoint/revert', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { name } = req.body as { name: string };
    if (!name) throw new Error('Checkpoint name required');
    await gitService.revertToCheckpoint(id, name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoManageRouter.get('/checkpoints', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const checkpoints = await gitService.listCheckpoints(id);
    res.json(checkpoints);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoManageRouter.delete('/checkpoint/:name', async (req, res) => {
  try {
    const { id, name } = req.params as { id: string; name: string };
    await gitService.deleteCheckpoint(id, name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoManageRouter.get('/archive', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const branch = (req.query.branch as string) || 'dirty';
    const stream = await gitService.createArchive(id, branch);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="archive.zip"');
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
