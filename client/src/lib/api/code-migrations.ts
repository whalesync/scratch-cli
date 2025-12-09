import { API_CONFIG } from './config';
import { handleAxiosError } from './error';

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
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.get<AvailableMigrationsResponse>('/code-migrations/available');
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to fetch available migrations');
    }
  },

  runMigration: async (request: RunMigrationRequest): Promise<MigrationResult> => {
    try {
      const axios = API_CONFIG.getAxiosInstance();
      const res = await axios.post<MigrationResult>('/code-migrations/run', request);
      return res.data;
    } catch (error) {
      handleAxiosError(error, 'Failed to run migration');
    }
  },
};
