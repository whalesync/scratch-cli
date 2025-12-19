import { OpenRouterModel } from '@spinner/shared-types';

export interface CostCalculation {
  promptCost: number;
  completionCost: number;
  totalCost: number;
}

/**
 * Calculates the cost of an AI agent message based on token usage and model pricing
 * @param modelId - The ID of the model used (e.g., "anthropic/claude-3-5-sonnet")
 * @param requestTokens - Number of tokens in the request/prompt
 * @param responseTokens - Number of tokens in the response/completion
 * @param models - Array of available models with pricing information
 * @returns Cost breakdown in dollars
 */
export function calculateMessageCost(
  modelId: string,
  requestTokens: number,
  responseTokens: number,
  models: OpenRouterModel[] | undefined,
): CostCalculation {
  if (!models || models.length === 0) {
    console.warn('No models available for cost calculation');
    return { promptCost: 0, completionCost: 0, totalCost: 0 };
  }

  const model = models.find((m) => m.id === modelId);

  if (!model) {
    console.warn(`Model ${modelId} not found in pricing data`);
    return { promptCost: 0, completionCost: 0, totalCost: 0 };
  }

  // OpenRouter pricing is per token, so we multiply by token count
  // pricing.prompt and pricing.completion are strings representing cost per token
  const promptCostPerToken = parseFloat(model.pricing.prompt) || 0;
  const completionCostPerToken = parseFloat(model.pricing.completion) || 0;

  const promptCost = promptCostPerToken * requestTokens;
  const completionCost = completionCostPerToken * responseTokens;
  const totalCost = promptCost + completionCost;

  return {
    promptCost,
    completionCost,
    totalCost,
  };
}

/**
 * Formats a cost value as a USD currency string
 * @param cost - Cost in dollars
 * @returns Formatted string (e.g., "$0.0023" or "$0.00")
 */
export function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';

  // For very small amounts, show more decimal places
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  }

  return `$${cost.toFixed(4)}`;
}
