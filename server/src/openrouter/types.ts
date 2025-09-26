export interface OpenRouterKeyData {
  name: string;
  label: string;
  limit: number;
  disabled: true;
  created_at: string;
  updated_at: string;
  hash: string;
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
}

export interface OpenRouterUpdateApiKeyResponse {
  data: OpenRouterKeyData;
}
