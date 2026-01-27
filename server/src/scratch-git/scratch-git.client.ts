import { Injectable } from '@nestjs/common';

@Injectable()
export class ScratchGitClient {
  private readonly gitApiUrl = process.env.SCRATCH_GIT_URL || 'http://localhost:3100';

  private async callGitApi(endpoint: string, method: string, body: any): Promise<any> {
    const response = await fetch(`${this.gitApiUrl}${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Git API Error ${endpoint}: ${response.status} ${text}`);
    }
    return response.json();
  }

  async createRepo(repoId: string): Promise<void> {
    await this.callGitApi('/api/repo/create', 'POST', { repoId });
  }

  async commit(
    repoId: string,
    files: { path: string; content: string }[],
    message: string,
    author: { name: string; email: string },
  ): Promise<void> {
    await this.callGitApi('/api/exec/commit', 'POST', {
      repoId,
      files,
      message,
      author,
    });
  }

  async branchDirty(repoId: string, userId: string): Promise<void> {
    await this.callGitApi('/api/branch/dirty', 'POST', {
      repoId,
      userId,
    });
  }
}
