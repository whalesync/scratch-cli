import { Injectable } from '@nestjs/common';
import { ScratchConfigService } from 'src/config/scratch-config.service';

@Injectable()
export class ScratchGitClient {
  private readonly gitApiUrl: string;

  constructor(private readonly configService: ScratchConfigService) {
    this.gitApiUrl = this.configService.getScratchGitApiUrl();
  }

  private async callGitApi(endpoint: string, method: string, body?: any): Promise<unknown> {
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

  async resetRepo(repoId: string, path?: string): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}/reset`, 'POST', { path });
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

  async deleteFolder(repoId: string, folder: string, message: string): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}/folder?folder=${encodeURIComponent(folder)}`, 'DELETE', {
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

  async getFile(repoId: string, branch: string, path: string): Promise<{ content: string } | null> {
    try {
      const response = await this.callGitApi(
        `/api/repo/${repoId}/file?branch=${branch}&path=${encodeURIComponent(path)}`,
        'GET',
      );
      return response as { content: string };
    } catch {
      // TODO: handle error properly
      return null;
    }
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

  async createCheckpoint(repoId: string, name: string): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}/checkpoint`, 'POST', { name });
  }

  async listCheckpoints(repoId: string): Promise<{ name: string; timestamp: number; message: string }[]> {
    return this.callGitApi(`/api/repo/${repoId}/checkpoints`, 'GET') as Promise<
      { name: string; timestamp: number; message: string }[]
    >;
  }

  async revertToCheckpoint(repoId: string, name: string): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}/checkpoint/revert`, 'POST', { name });
  }

  async deleteCheckpoint(repoId: string, name: string): Promise<void> {
    await this.callGitApi(`/api/repo/${repoId}/checkpoint/${encodeURIComponent(name)}`, 'DELETE');
  }
}
