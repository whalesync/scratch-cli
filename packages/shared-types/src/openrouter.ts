/**
 * OpenRouter API types
 * https://openrouter.ai/docs
 */

export interface OpenRouterModelPricing {
  /** Cost per million tokens for prompt */
  prompt: string;
  /** Cost per million tokens for completion */
  completion: string;
  /** Cost per request */
  request: string;
  /** Cost per image */
  image: string;
}

export interface OpenRouterModel {
  /** Model ID (e.g., 'openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet') */
  id: string;
  /** Human-readable model name */
  name: string;
  /** Unix timestamp when the model was created */
  created: number;
  /** Model description */
  description: string;
  /** Pricing information */
  pricing: OpenRouterModelPricing;
  /** Maximum context length in tokens */
  context_length: number;
  /** Model architecture details */
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type: string | null;
  };
  /** Top provider information */
  top_provider: {
    context_length: number;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  /** Per-request limits */
  per_request_limits: {
    prompt_tokens: string;
    completion_tokens: string;
  } | null;
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}
