import { Router } from 'express';
import fs from 'node:fs';
import { resolve } from 'node:path';

export const systemRouter = Router();

const buildVersion = process.env.BUILD_VERSION || '0.0.0-local';
const reposDir = resolve(process.env.GIT_REPOS_DIR || 'repos');

systemRouter.get('/', (_, res) =>
  res.json({
    server: 'ScratchGit API',
    build_version: buildVersion,
  }),
);

systemRouter.get('/health', (_, res) =>
  res.json({
    status: 'alive',
    build_version: buildVersion,
    reposDir,
    reposDirExists: fs.existsSync(reposDir),
    timestamp: new Date().toISOString(),
  }),
);
