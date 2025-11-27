'use client';

import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ModelOption, PersistedModelOption } from '@/types/common';
import { UserSetting } from '@/types/server-entities/users';
import { Alert, Box, Card, Checkbox, Group, Loader, Radio, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge, BadgeOK } from './base/badge';

// Popular model keys - these will be sorted to the top
const POPULAR_MODEL_KEYS = [
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'openai/gpt-5-mini-2025-08-07',
  'openai/gpt-5-2025-08-07',
  'anthropic/claude-3-5-sonnet',
  'anthropic/claude-3-haiku',
  'google/gemini-2.5-pro',
  'google/gemini-2.5-flash',
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

interface ModelPickerProps {
  currentModelOption: PersistedModelOption;
  onChange: (modelOption: ModelOption) => void;
  placeholder?: string;
}

export default function ModelPicker({ currentModelOption, onChange }: ModelPickerProps) {
  const { getUserSetting } = useScratchPadUser();
  const [allModels, setAllModels] = useState<ModelOption[]>([]);
  const [filteredModels, setFilteredModels] = useState<ModelOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
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
          label: model.name,
          provider: model.name.split(':')[0] || 'Unknown',
          description: model.description || 'No description available',
          contextLength: model.context_length,
          id: model.id,
          canonicalSlug: model.canonical_slug,
          created: model.created,
          pricing: model.pricing,
          isPopular: POPULAR_MODEL_KEYS.includes(model.canonical_slug),
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
        setFilteredModels(sortedModels);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch models');
        setAllModels([]);
        setFilteredModels([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  const currentFavoriteModel = useMemo(() => {
    return getUserSetting(UserSetting.DEFAULT_LLM_MODEL);
  }, [getUserSetting]);

  // Get unique providers from all models, with popular ones first
  const popularProviders = [...new Set(allModels.filter((model) => model.isPopular).map((model) => model.provider))];
  const allProviders = [...new Set(allModels.map((model) => model.provider))];
  const nonPopularProviders = allProviders.filter((provider) => !popularProviders.includes(provider)).sort();
  const providers = [...popularProviders.sort(), ...nonPopularProviders];

  // Helper function to check if a model is free
  const isModelFree = (model: ModelOption) => {
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
  };

  // Filter models based on search query, provider, and free filter
  useEffect(() => {
    let filtered = allModels;

    // Filter by provider
    if (selectedProvider) {
      filtered = filtered.filter((model) => model.provider === selectedProvider);
    }

    // Filter by free models
    if (showFreeOnly) {
      filtered = filtered.filter(isModelFree);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const queryWords = searchQuery
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 0);
      filtered = filtered.filter((model) => {
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
    }

    setFilteredModels(filtered);
  }, [searchQuery, selectedProvider, showFreeOnly, allModels]);

  const formatModelLabel = (model: ModelOption) => (
    <Group gap="xs" justify="space-between" w="100%">
      <Box>
        <Text size="sm" fw={500}>
          {model.label}
        </Text>

        <Text size="xs" c="dimmed">
          {model.provider}
        </Text>
        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
          ID: {model.id}
        </Text>
        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
          Slug: {model.canonicalSlug}
        </Text>
        <Text size="xs" c="dimmed">
          Created: {new Date(model.created * 1000).toISOString().split('T')[0]}
        </Text>
      </Box>
      <Stack gap="xs" align="flex-end">
        {currentFavoriteModel === model.value && <BadgeOK>Default Model</BadgeOK>}
        {model.contextLength && <Badge>{model.contextLength.toLocaleString()} tokens</Badge>}
        {isModelFree(model) && <Badge color="green">Free</Badge>}
      </Stack>
    </Group>
  );

  const formatModelDescription = (model: ModelOption) => (
    <Text size="xs" c="dimmed" lineClamp={2}>
      {model.description}
    </Text>
  );

  if (isLoading) {
    return (
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          Loading models...
        </Text>
        <Loader size="sm" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Stack gap="xs">
        <Alert color="red" title="Error loading models">
          {error}
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md" h="100%">
      <Text size="sm" c="dimmed">
        Choose a model for AI generation. Different models have different capabilities and costs.
      </Text>

      <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
        {/* Left panel - Search and filters */}
        <div style={{ width: '30%', minWidth: '200px' }}>
          <Stack gap="md">
            <TextInput
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftSection={<Search size={16} />}
              size="sm"
            />

            <Radio.Group
              value={selectedProvider || ''}
              onChange={(val) => setSelectedProvider(val || null)}
              name="provider"
              label="Provider"
            >
              <ScrollArea h={200} type="auto">
                <Stack gap={5}>
                  <Radio value="" label="All providers" />
                  {providers.map((provider) => (
                    <Radio key={provider} value={provider} label={provider} />
                  ))}
                </Stack>
              </ScrollArea>
            </Radio.Group>

            <Checkbox
              label="Show free models only"
              checked={showFreeOnly}
              onChange={(event) => setShowFreeOnly(event.currentTarget.checked)}
            />
          </Stack>
        </div>

        {/* Right panel - Models list */}
        <div style={{ width: '70%', flex: 1 }}>
          <ScrollArea h={400} pr="md">
            <Stack gap="md">
              {filteredModels.map((model) => (
                <Card
                  key={model.value}
                  p="sm"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    border:
                      currentModelOption.value === model.value ? '2px solid var(--mantine-color-blue-6)' : undefined,
                  }}
                  onClick={() => onChange(model)}
                >
                  <Stack gap="xs">
                    {formatModelLabel(model)}
                    {formatModelDescription(model)}
                    {model.isPopular && <Badge color="green">Popular</Badge>}
                  </Stack>
                </Card>
              ))}
            </Stack>
          </ScrollArea>

          {filteredModels.length > 0 && (
            <Text size="xs" c="dimmed">
              Showing {filteredModels.length} of {allModels.length} models
            </Text>
          )}
        </div>
      </div>
    </Stack>
  );
}
