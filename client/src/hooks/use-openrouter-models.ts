import { ModelOption } from '@/types/common';
import { useEffect, useMemo, useState } from 'react';
import { useSubscription } from './use-subscription';

// Popular model keys - these will be sorted to the top
const POPULAR_MODEL_IDS = [
  'anthropic/claude-3-5-sonnet',
  'anthropic/claude-3-haiku',
  'anthropic/claude-haiku-4.5',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'google/gemini-3-pro-preview',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-5-2025-08-07',
  'openai/gpt-5-mini-2025-08-07',
  'openai/gpt-oss-120b',
  'x-ai/grok-4.1-fast',
];

interface OpenRouterModel {
  id: string;
  canonical_slug: string;
  hugging_face_id: string | null;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    modality: string;
    input_modalities: string[];
    output_modalities: string[];
    tokenizer: string;
    instruct_type: string | null;
  };
  pricing: {
    prompt: string;
    completion: string;
    request: string;
    image: string;
    web_search: string;
    internal_reasoning: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens: number | null;
    is_moderated: boolean;
  };
  per_request_limits: unknown | null;
  supported_parameters: string[];
}

interface ModelProviderGroup {
  provider: string;
  models: ModelOption[];
}

export function useOpenRouterModels() {
  const { allowedModels } = useSubscription();
  const [allModels, setAllModels] = useState<ModelOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch models from OpenRouter API
  useEffect(() => {
    const fetchModels = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('https://openrouter.ai/api/v1/models');
        if (!response.ok) {
          throw new Error(`Failed to fetch models: ${response.statusText}`);
        }

        const data = await response.json();
        const models: ModelOption[] = data.data.map((model: OpenRouterModel) => ({
          value: model.id,
          label: model.name.split(':')[1] || model.name,
          provider: model.name.split(':')[0] || 'Unknown',
          description: model.description || 'No description available',
          contextLength: model.context_length,
          id: model.id,
          canonicalSlug: model.canonical_slug,
          created: model.created,
          pricing: model.pricing,
          isPopular: POPULAR_MODEL_IDS.includes(model.id),
        }));

        // Sort models: popular ones first, then alphabetically by label
        const sortedModels = models.sort((a, b) => {
          // Popular models first
          if (a.isPopular && !b.isPopular) return -1;
          if (!a.isPopular && b.isPopular) return 1;

          // Then alphabetically by label
          return a.label.localeCompare(b.label);
        });

        setAllModels(sortedModels);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch models');
        setAllModels([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  // Get models filtered by subscription restrictions only (not by search/provider/free filters)
  const subscriptionFilteredModels = useMemo(() => {
    if (!allowedModels || allowedModels.length === 0) {
      return allModels; // Empty = all models allowed
    }
    return allModels.filter((model) => allowedModels.includes(model.id) || allowedModels.includes(model.canonicalSlug));
  }, [allModels, allowedModels]);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) {
      return showFreeOnly
        ? subscriptionFilteredModels.filter((model) => isModelFree(model))
        : subscriptionFilteredModels;
    }

    const queryWords = searchQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    return subscriptionFilteredModels
      .filter((model) => (showFreeOnly ? isModelFree(model) : true))
      .filter((model) => {
        const searchableText = [
          model.label.toLowerCase(),
          model.provider.toLowerCase(),
          model.description.toLowerCase(),
          model.value.toLowerCase(),
          model.id.toLowerCase(),
          model.canonicalSlug.toLowerCase(),
        ].join(' ');

        return queryWords.every((word) => searchableText.includes(word));
      });
  }, [searchQuery, subscriptionFilteredModels, showFreeOnly]);

  const filteredModelsByProvider: ModelProviderGroup[] = useMemo(() => {
    const results = Object.values(
      filteredModels.reduce(
        (acc, model) => {
          acc[model.provider] = acc[model.provider] || [];
          acc[model.provider].push(model);
          return acc;
        },
        {} as Record<string, ModelOption[]>,
      ),
    )
      .map((models) => ({
        provider: models[0].provider,
        models,
      }))
      .sort((a, b) => {
        return a.provider.localeCompare(b.provider);
      });

    // add Recommended section at the top of the list
    // const recommendedModels =  filteredModels.filter((model) => model.isPopular);
    // return [
    //   {
    //     provider: 'Recommended',
    //     models: recommendedModels,
    //   },
    //   ...results,
    // ];

    return results;
  }, [filteredModels]);

  return {
    allModels,
    filteredModels,
    subscriptionFilteredModels,
    searchQuery,
    setSearchQuery,
    showFreeOnly,
    setShowFreeOnly,
    isLoading,
    error,
    filteredModelsByProvider,
  };
}

export function isModelFree(model: ModelOption) {
  if (!model.pricing) return false;
  const pricing = model.pricing;
  return (
    parseFloat(pricing.prompt) === 0 &&
    parseFloat(pricing.completion) === 0 &&
    parseFloat(pricing.request) === 0 &&
    parseFloat(pricing.image) === 0 &&
    parseFloat(pricing.web_search) === 0 &&
    parseFloat(pricing.internal_reasoning) === 0
  );
}
