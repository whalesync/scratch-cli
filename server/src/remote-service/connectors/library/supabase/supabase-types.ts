/**
 * Supabase Management API type definitions.
 * Ported from Whalesync's supabase-types.ts.
 */

export interface SupabaseProject {
  id: string;
  organization_id: string;
  name: string;
  region: string;
  created_at: string;
  status: string;
}

export interface SupabasePoolerConfig {
  database_type: string;
  default_pool_size: number;
  pool_mode: string;
  connection_string: string;
}

export interface SupabaseProjectConfig {
  projectRef: string;
  projectName: string;
  connectionString: string;
}

export interface SupabaseCredentials {
  /** Manual single-project mode */
  connectionString?: string;
  /** OAuth multi-project mode */
  projects?: SupabaseProjectConfig[];
  oauthAccessToken?: string;
}
