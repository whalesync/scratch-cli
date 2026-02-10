/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { GitService } from '../../lib/GitService';

export const repoDebugRouter = Router({ mergeParams: true });
const gitService = new GitService();

repoDebugRouter.get('/graph', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const graph = await gitService.getGraphData(id);
    res.json(graph);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
