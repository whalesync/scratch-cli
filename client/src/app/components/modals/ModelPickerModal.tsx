'use client';

import customBordersClasses from '@/app/components/theme/custom-borders.module.css';
import { useOpenRouterModels } from '@/hooks/use-openrouter-models';
import { ModelOption, PersistedModelOption } from '@/types/common';
import { Box, Center, Group, ModalProps, ScrollArea, SegmentedControl, Stack, TextInput } from '@mantine/core';
import { CheckIcon, Search } from 'lucide-react';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '../base/buttons';
import { Text13Book, Text13Medium, Text13Regular } from '../base/text';
import { DotSpacer } from '../DotSpacer';
import { ModelProviderIcon } from '../Icons/ModelProvidericon';
import { StyledLucideIcon } from '../Icons/StyledLucideIcon';
import { ErrorInfo } from '../InfoPanel';
import { LoaderWithMessage } from '../LoaderWithMessage';
import { ModalWrapper } from '../ModalWrapper';

interface ModelPickerModalProps extends ModalProps {
  currentModelOption: PersistedModelOption;
  onSelectModel: (modelOption: ModelOption) => void;
}

function formatShortContextLength(contextLength?: number): string {
  if (!contextLength) {
    return '';
  }

  if (contextLength >= 1000000) {
    const millions = contextLength / 1000000;
    // If it's a whole number, show without decimals
    if (millions % 1 === 0) {
      return `${millions}M`;
    }
    // Otherwise, show one decimal place
    return `${millions.toFixed(1)}M`;
  }

  if (contextLength >= 1000) {
    const thousands = contextLength / 1000;
    // If it's a whole number, show without decimals
    if (thousands % 1 === 0) {
      return `${thousands}k`;
    }
    // Otherwise, show one decimal place
    return `${thousands.toFixed(1)}k`;
  }

  return `${contextLength.toLocaleString()}`;
}

export default function ModelPickerModal({ currentModelOption, onSelectModel, ...modalProps }: ModelPickerModalProps) {
  const [activeModel, setActiveModel] = useState<ModelOption | undefined>();

  const activeItemRef = useRef<HTMLDivElement>(null);
  const {
    filteredModelsByProvider,
    filteredModels,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    showFreeOnly,
    setShowFreeOnly,
  } = useOpenRouterModels();

  useEffect(() => {
    if (activeModel === undefined) {
      const currentModel = filteredModels.find((model) => model.id === currentModelOption.value);
      setActiveModel(currentModel);
    }
  }, [activeModel, currentModelOption.value, filteredModels]);

  useEffect(() => {
    if (activeItemRef.current && !isLoading && filteredModels.length > 0) {
      // Use setTimeout to ensure the DOM is fully rendered
      const timeoutId = setTimeout(() => {
        activeItemRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, filteredModels.length]);

  return (
    <ModalWrapper
      title="Select Model"
      size="xl"
      centered
      customProps={{
        noBodyPadding: true,
        footer: (
          <Group pt="12px">
            <ButtonSecondaryOutline variant="outline" onClick={() => modalProps.onClose?.()}>
              Cancel
            </ButtonSecondaryOutline>
            <ButtonPrimaryLight
              disabled={activeModel === undefined || activeModel.id === currentModelOption.value}
              onClick={() => activeModel && onSelectModel(activeModel)}
            >
              Select Model
            </ButtonPrimaryLight>
          </Group>
        ),
      }}
      {...modalProps}
    >
      {isLoading && <LoaderWithMessage message="Loading models..." />}
      {error && <ErrorInfo title="Error loading models" description={error} />}
      {!isLoading && !error && (
        <Group w="100%" align="flex-start" p="0px">
          <Stack w="320px" style={{ borderRight: '0.5px solid var(--fg-divider)' }}>
            <Group
              py="12px"
              px="16px"
              w="100%"
              justify="space-between"
              style={{ borderBottom: '0.5px solid var(--fg-divider)' }}
            >
              <TextInput
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftSection={<Search size={16} />}
                size="sm"
              />
              <SegmentedControl
                size="xs"
                value={showFreeOnly ? 'free' : 'all'}
                onChange={(value) => setShowFreeOnly(value === 'free')}
                data={[
                  { label: 'All', value: 'all' },
                  { label: 'Free', value: 'free' },
                ]}
              />
            </Group>
            <Box>
              <ScrollArea h={400} type="hover">
                <Stack gap={6}>
                  {filteredModelsByProvider
                    .filter((providerGroup) => providerGroup.models.length > 0)
                    .map((providerGroup, index) => (
                      <Stack
                        key={providerGroup.provider}
                        gap="2px"
                        px="16px"
                        py="5px"
                        style={{ borderTop: index > 0 ? '0.5px solid var(--fg-divider)' : '0.5px solid transparent' }}
                      >
                        <Text13Medium c="var(--fg-muted)" py={9}>
                          {providerGroup.provider}
                        </Text13Medium>
                        {providerGroup.models.map((model) => (
                          <ModelListItem
                            key={model.id}
                            ref={model.id === currentModelOption.value ? activeItemRef : null}
                            model={model}
                            onClick={() => setActiveModel(model)}
                            selected={model.id === currentModelOption.value}
                            active={model.id === activeModel?.id}
                          />
                        ))}
                      </Stack>
                    ))}
                </Stack>
              </ScrollArea>
            </Box>
          </Stack>
          <Stack flex={1} p={0}>
            {activeModel ? (
              <ModelCard model={activeModel} />
            ) : (
              <Center w="100%" h="100%">
                <Text13Regular>No model selected</Text13Regular>
              </Center>
            )}
          </Stack>
        </Group>
      )}
    </ModalWrapper>
  );
}

export const ModelCard = ({ model }: { model: ModelOption }) => {
  const truncatedDescription =
    model.description && model.description.length > 500
      ? `${model.description.substring(0, 500)}...`
      : model.description;

  return (
    <Stack gap={12} p={16}>
      <ModelProviderIcon model={model.id} size={24} />
      <Text13Medium>
        {model.provider} / {model.label}
      </Text13Medium>
      <Text13Book c="var(--fg-muted)">{truncatedDescription}</Text13Book>
      <Stack gap={6}>
        <Group wrap="nowrap">
          <Text13Book w={130} c="var(--fg-muted)">
            Context
          </Text13Book>
          <Text13Regular>{model.contextLength?.toLocaleString()} tokens</Text13Regular>
        </Group>
        <Group wrap="nowrap">
          <Text13Book w={130} c="var(--fg-muted)">
            Created
          </Text13Book>
          <Text13Regular>{new Date(model.created * 1000).toISOString().split('T')[0]}</Text13Regular>
        </Group>
        <Group wrap="nowrap">
          <Text13Book w={130} c="var(--fg-muted)">
            ID
          </Text13Book>
          <Text13Regular>{model.id}</Text13Regular>
        </Group>
      </Stack>
    </Stack>
  );
};

const ModelListItem = forwardRef<
  HTMLDivElement,
  {
    model: ModelOption;
    active?: boolean;
    selected?: boolean;
    onClick: () => void;
  }
>(({ model, onClick, active = false, selected = false }, ref) => {
  const shortTokens = formatShortContextLength(model.contextLength);

  return (
    <Group
      ref={ref}
      justify="flex-start"
      align="center"
      gap="6px"
      wrap="nowrap"
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      w="100%"
      className={active ? customBordersClasses.cornerBorders : undefined}
      bg={active ? 'var(--bg-selected)' : 'transparent'}
      h="28px"
      p="4px 8px"
    >
      <ModelProviderIcon model={model.id} size={20} withBorder />
      <Text13Regular>{model.label}</Text13Regular>
      <DotSpacer p={0} mx={0} />
      <Text13Book c="var(--fg-muted)">{shortTokens}</Text13Book>
      {selected && (
        <Box ml="auto">
          <StyledLucideIcon Icon={CheckIcon} size={16} />
        </Box>
      )}
    </Group>
  );
});

ModelListItem.displayName = 'ModelListItem';
