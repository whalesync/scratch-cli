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
