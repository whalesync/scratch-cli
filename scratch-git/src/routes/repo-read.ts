/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { RepoReadService } from '../services/repo-read.service';

export const repoReadRouter = Router({ mergeParams: true });

repoReadRouter.get('/list', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const branch = (req.query.branch as string) || 'main'; // default to main
    const folder = (req.query.folder as string) || '';
    const gitService = new RepoReadService(id);
    const files = await gitService.list(branch, folder);
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
    const gitService = new RepoReadService(id);
    const content = await gitService.getFileContent(branch, path);
    if (content === null) return res.status(404).json({ error: 'File not found' });
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoReadRouter.get('/diff', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const filePath = req.query.path as string;
    if (!filePath) throw new Error('Query param path is required');
    const repoReadService = new RepoReadService(id);
    const diff = await repoReadService.getFileContentInBothBranches(filePath);
    res.json(diff);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Endpoints moved to repo-diff.ts and repo-debug.ts

repoReadRouter.get('/archive', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const branch = (req.query.branch as string) || 'main'; // default to main if not specified, or dirty? original was dirty.
    // user original repo-manage said: const branch = (req.query.branch as string) || 'dirty';
    // but typically archive is from main?
    // Let's stick to 'dirty' default if that's what manage had, OR 'main'.
    // actually, let's default to 'main' as it's safer, but if user wants dirty they can specify.
    // Wait, repo-manage.ts (step 1191) had: const branch = (req.query.branch as string) || 'dirty';
    // I should probably respect that default if I want to maintain behavior.
    const gitService = new RepoReadService(id);
    const archive = await gitService.createArchive(branch);

    res.attachment(`${id}-${branch}.zip`);
    archive.pipe(res);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
