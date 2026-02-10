/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { RepoDebugService } from '../services/repo-debug.service';

export const repoDebugRouter = Router({ mergeParams: true });

repoDebugRouter.get('/graph', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const gitService = new RepoDebugService(id);
    const graph = await gitService.getGraphData();
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
