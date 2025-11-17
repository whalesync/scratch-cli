import { API_CONFIG } from './config';
import { checkForApiError } from './error';

export interface AvailableMigrationsResponse {
  migrations: string[];
}

export interface MigrationResult {
  migratedIds: string[];
  remainingCount: number;
  migrationName: string;
}

export interface RunMigrationRequest {
  migration: string;
  qty?: number;
  ids?: string[];
}

export const codeMigrationsApi = {
  getAvailableMigrations: async (): Promise<AvailableMigrationsResponse> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/code-migrations/available`, {
      method: 'GET',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
    });
    await checkForApiError(res, 'Failed to fetch available migrations');
    return res.json();
  },

  runMigration: async (request: RunMigrationRequest): Promise<MigrationResult> => {
    const res = await fetch(`${API_CONFIG.getApiUrl()}/code-migrations/run`, {
      method: 'POST',
      headers: {
        ...API_CONFIG.getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    await checkForApiError(res, 'Failed to run migration');
    return res.json();
  },
};
