export interface OpenRouterKeyData {
  name: string;
  label: string;
  limit: number;
  usage: number;
  disabled: true;
  created_at: string;
  updated_at: string;
  hash: string;
}

export interface OpenRouterGetCurrentApiKeyData {
  label: string;
  limit: number;
  usage: number;
  is_free_tier: boolean;
  limit_remaining: number;
  limit_reset: string;
  is_provisioning_key: boolean;
  usage_daily: number;
  usage_weekly: number;
  usage_monthly: number;
  byok_usage: number;
  byok_usage_daily: number;
  byok_usage_weekly: number;
  byok_usage_monthly: number;
  include_byok_in_limit: boolean;
  expires_at: string;
}

export interface OpenRouterCreateKeyResponse {
  data: OpenRouterKeyData;
  key: string;
}

export interface GetOpenRouterKeyResponse {
  data: OpenRouterKeyData;
}

export interface OpenRouterGetCreditsResponse {
  data: {
    total_credits: number;
    total_usage: number;
  };
}

export interface OpenRouterDeleteKeyResponse {
  data: {
    success: boolean;
  };
}

export interface OpenRouterUpdateRequest {
  name?: string;
  disabled?: boolean;
  include_byok_in_limit?: boolean;
  limit?: number;
  limit_reset?: 'daily' | 'weekly' | 'monthly' | 'never';
}

export interface OpenRouterUpdateApiKeyResponse {
  data: OpenRouterKeyData;
}

export interface OpenRouterGetCurrentApiKeyResponse {
  data: OpenRouterGetCurrentApiKeyData;
}
