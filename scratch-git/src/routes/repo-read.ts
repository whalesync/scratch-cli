/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { GitService } from '../../lib/GitService';

export const repoReadRouter = Router({ mergeParams: true });
const gitService = new GitService();

repoReadRouter.get('/list', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const branch = (req.query.branch as string) || 'main'; // default to main
    const folder = (req.query.folder as string) || '';
    const files = await gitService.list(id, branch, folder);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoReadRouter.get('/file', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const branch = (req.query.branch as string) || 'main';
    const path = req.query.path as string;
    if (!path) throw new Error('Query param path is required');
    const content = await gitService.getFile(id, branch, path);
    if (content === null) return res.status(404).json({ error: 'File not found' });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Endpoints moved to repo-diff.ts and repo-debug.ts
