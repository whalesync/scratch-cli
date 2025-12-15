'use client';

import { useOpenRouterModels } from '@/hooks/use-openrouter-models';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ModelOption, PersistedModelOption } from '@/types/common';
import { UserSetting } from '@/types/server-entities/users';
import { Alert, Box, Card, Checkbox, Group, Loader, Radio, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, BadgeOK } from './base/badge';

interface ModelPickerProps {
  currentModelOption: PersistedModelOption;
  onChange: (modelOption: ModelOption) => void;
  placeholder?: string;
  /**
   * List of allowed model IDs. If empty, all models are allowed.
   * When provided with values, only models matching these IDs will be shown.
   */
  allowedModels?: string[];
}

/**
 * @deprecated use useOpenRouterModels instead
 */
export default function ModelPicker({ currentModelOption, onChange }: ModelPickerProps) {
  const { getUserSetting } = useScratchPadUser();
  const {
    filteredModels: searchFilteredModels,
    subscriptionFilteredModels,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
  } = useOpenRouterModels();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showFreeOnly, setShowFreeOnly] = useState(false);

  const currentFavoriteModel = useMemo(() => {
    return getUserSetting(UserSetting.DEFAULT_LLM_MODEL);
  }, [getUserSetting]);

  // Get unique providers from subscription-filtered models, with popular ones first
  const popularProviders = [
    ...new Set(subscriptionFilteredModels.filter((model) => model.isPopular).map((model) => model.provider)),
  ];
  const allProviders = [...new Set(subscriptionFilteredModels.map((model) => model.provider))];
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

  // Filter models based on provider and free filter
  // (subscription and search filtering are already applied via the hook)
  const filteredModels = useMemo(() => {
    let filtered = searchFilteredModels;

    // Filter by provider
    if (selectedProvider) {
      filtered = filtered.filter((model) => model.provider === selectedProvider);
    }

    // Filter by free models
    if (showFreeOnly) {
      filtered = filtered.filter(isModelFree);
    }

    return filtered;
  }, [searchFilteredModels, selectedProvider, showFreeOnly]);

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
              Showing {filteredModels.length} of {subscriptionFilteredModels.length} models
            </Text>
          )}
        </div>
      </div>
    </Stack>
  );
}
