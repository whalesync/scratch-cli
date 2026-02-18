/**
 * Supabase Management API client.
 * Ported from Whalesync's supabase-api-client.ts — uses axios for HTTP requests.
 *
 * All endpoints authenticate with Bearer token from the Supabase OAuth flow.
 */
import axios, { AxiosError } from 'axios';
import { SupabasePoolerConfig, SupabaseProject } from './supabase-types';

const SUPABASE_API_BASE = 'https://api.supabase.com/v1';

export class SupabaseApiClient {
  private readonly headers: Record<string, string>;

  constructor(accessToken: string) {
    this.headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * List all Supabase projects accessible to the authenticated user.
   * GET /v1/projects
   */
  async getProjects(): Promise<SupabaseProject[]> {
    const response = await this.get<SupabaseProject[]>('/projects');
    return response;
  }

  /**
   * Get the connection pooler (Supavisor) configuration for a project.
   * GET /v1/projects/{ref}/config/database/pooler
   */
  async getPoolerConfig(projectRef: string): Promise<SupabasePoolerConfig[]> {
    const response = await this.get<SupabasePoolerConfig[]>(`/projects/${projectRef}/config/database/pooler`);
    return response;
  }

  /**
   * Execute a raw SQL query on the project's database via the Management API.
   * POST /v1/projects/{ref}/database/query
   *
   * This runs as the project's `postgres` superuser, so it can create roles,
   * grant permissions, and execute DDL that the service account cannot.
   */
  async executeQuery(projectRef: string, query: string): Promise<unknown> {
    const response = await axios.post(
      `${SUPABASE_API_BASE}/projects/${projectRef}/database/query`,
      { query },
      {
        headers: this.headers,
        timeout: 30_000,
      },
    );
    return response.data;
  }

  private async get<T>(path: string): Promise<T> {
    try {
      const response = await axios.get<T>(`${SUPABASE_API_BASE}${path}`, {
        headers: this.headers,
        timeout: 15_000,
      });
      return response.data;
    } catch (error) {
      throw this.wrapError(error, path);
    }
  }

  private wrapError(error: unknown, path: string): Error {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const data: unknown = error.response?.data;
      const message =
        typeof data === 'object' && data !== null && 'message' in data
          ? String((data as { message: string }).message)
          : error.message;

      if (status === 401) {
        return new SupabaseApiError(`Supabase authorization failed. Please reconnect your account.`, status);
      }
      if (status === 403) {
        return new SupabaseApiError(`Insufficient permissions for Supabase API (${path}).`, status);
      }
      return new SupabaseApiError(`Supabase API error (${status ?? 'unknown'}): ${message}`, status);
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}

export class SupabaseApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'SupabaseApiError';
  }
}
