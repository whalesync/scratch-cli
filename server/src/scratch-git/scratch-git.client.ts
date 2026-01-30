import { Injectable } from '@nestjs/common';

@Injectable()
export class ScratchGitClient {
  private readonly gitApiUrl = process.env.SCRATCH_GIT_URL || 'http://localhost:3100';

  private async callGitApi(endpoint: string, method: string, body?: any): Promise<any> {
    const options: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.gitApiUrl}${endpoint}`, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Git API Error ${endpoint}: ${response.status} ${text}`);
    }
    return response.json();
  }

  async initRepo(repoId: string): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}/init`, 'POST');
  }

  async deleteRepo(repoId: string): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}`, 'DELETE');
  }

  async commitFiles(
    repoId: string,
    branch: string,
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}/files?branch=${branch}`, 'POST', {
      files,
      message,
    });
  }

  async deleteFiles(repoId: string, branch: string, files: string[], message: string): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}/files?branch=${branch}`, 'DELETE', {
      files,
      message,
    });
  }

  async publishFile(repoId: string, file: { path: string; content: string }, message: string): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}/publish`, 'POST', {
      file,
      message,
    });
  }

  async rebaseDirty(repoId: string): Promise<{ rebased: boolean; conflicts: string[] }> {
    return this.callGitApi(`/api/repo/${repoId}/rebase`, 'POST') as Promise<{ rebased: boolean; conflicts: string[] }>;
  }

  async list(repoId: string, branch: string, folder: string): Promise<any[]> {
    return this.callGitApi(
      `/api/repo/${repoId}/list?branch=${branch}&folder=${encodeURIComponent(folder)}`,
      'GET',
    ) as Promise<any[]>;
  }

  async getFile(repoId: string, branch: string, path: string): Promise<{ content: string }> {
    return this.callGitApi(
      `/api/repo/${repoId}/file?branch=${branch}&path=${encodeURIComponent(path)}`,
      'GET',
    ) as Promise<{ content: string }>;
  }

  async getStatus(repoId: string): Promise<any> {
    return this.callGitApi(`/api/repo/${repoId}/status`, 'GET');
  }

  async getDiff(repoId: string, path: string): Promise<string> {
    return this.callGitApi(`/api/repo/${repoId}/diff?path=${encodeURIComponent(path)}`, 'GET') as Promise<string>;
  }

  async getFolderDiff(
    repoId: string,
    folder: string,
  ): Promise<Array<{ path: string; status: 'added' | 'modified' | 'deleted' }>> {
    return this.callGitApi(`/api/repo/${repoId}/folder-diff?folder=${encodeURIComponent(folder)}`, 'GET') as Promise<
      Array<{ path: string; status: 'added' | 'modified' | 'deleted' }>
    >;
  }

  async getGraph(repoId: string): Promise<any> {
    return this.callGitApi(`/api/repo/${repoId}/graph`, 'GET');
  }
}
