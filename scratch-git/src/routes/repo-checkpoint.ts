/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { RepoCheckpointService } from '../services/repo-checkpoint.service';

export const repoCheckpointRouter = Router({ mergeParams: true });

repoCheckpointRouter.post('/', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { name } = req.body as { name: string };
    if (!name) throw new Error('Checkpoint name required');
    const checkpointService = new RepoCheckpointService(id);
    await checkpointService.createCheckpoint(name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoCheckpointRouter.post('/revert', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { name } = req.body as { name: string };
    if (!name) throw new Error('Checkpoint name required');
    const checkpointService = new RepoCheckpointService(id);
    await checkpointService.revertToCheckpoint(name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoCheckpointRouter.get('/', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const checkpointService = new RepoCheckpointService(id);
    const checkpoints = await checkpointService.listCheckpoints();
    res.json(checkpoints);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoCheckpointRouter.delete('/:name', async (req, res) => {
  try {
    const { id, name } = req.params as { id: string; name: string };
    const checkpointService = new RepoCheckpointService(id);
    await checkpointService.deleteCheckpoint(name);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
