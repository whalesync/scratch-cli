/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { RepoDiffService } from '../services/repo-diff.service';

export const repoDiffRouter = Router({ mergeParams: true });

repoDiffRouter.get('/status', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const repoDiffService = new RepoDiffService(id);
    const status = await repoDiffService.getDirtyStatus();
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
    const repoDiffService = new RepoDiffService(id);
    const files = await repoDiffService.getFolderDirtyStatus(folder);
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
