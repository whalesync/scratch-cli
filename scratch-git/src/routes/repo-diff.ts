/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { GitService } from '../../lib/GitService';

export const repoDiffRouter = Router({ mergeParams: true });
const gitService = new GitService();

repoDiffRouter.get('/status', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const status = await gitService.getDirtyStatus(id);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoDiffRouter.get('/folder-diff', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const folder = req.query.folder as string;
    if (!folder) throw new Error('Query param folder is required');
    const files = await gitService.getFolderDirtyStatus(id, folder);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoDiffRouter.get('/diff', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const filePath = req.query.path as string;
    if (!filePath) throw new Error('Query param path is required');
    const diff = await gitService.getFileDiff(id, filePath);
    res.json(diff);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
