/* eslint-disable @typescript-eslint/no-misused-promises */
import { Router } from 'express';
import { GitService } from '../../lib/GitService';

export const repoWriteRouter = Router({ mergeParams: true });
const gitService = new GitService();

repoWriteRouter.post('/files', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const branch = (req.query.branch as string) || 'main';
    const { files, message } = req.body as { files: { path: string; content: string }[]; message?: string };
    await gitService.commitFiles(
      id,
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

repoWriteRouter.delete('/files', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const branch = (req.query.branch as string) || 'main';
    const { files, message } = req.body as { files: string[]; message?: string }; // files is array of paths
    await gitService.deleteFiles(id, branch, files, message || 'Delete files');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoWriteRouter.delete('/folder', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const folder = req.query.folder as string;
    const branch = (req.query.branch as string) || 'dirty';
    if (!folder) throw new Error('Query param folder is required');
    const { message } = req.body as { message?: string };
    await gitService.deleteFolder(id, folder, message || 'Delete folder', branch);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoWriteRouter.delete('/data-folder', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const body = req.body as { path?: string };
    const folderPath = body.path || (req.query.path as string);
    if (!folderPath) {
      throw new Error('Path is required');
    }
    await gitService.removeDataFolder(id, folderPath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoWriteRouter.post('/publish', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const { file, message } = req.body as { file: { path: string; content: string }; message?: string };
    await gitService.publishFile(id, file, message || 'Publish file');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

repoWriteRouter.post('/rebase', async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const body = req.body as { strategy?: string };
    const strategy = body.strategy;
    const result = await gitService.rebaseDirty(id, strategy as 'ours' | 'diff3');
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
