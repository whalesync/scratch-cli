import { Box, CheckIcon, Group, Stack } from '@mantine/core';
import { FC } from 'react';
import { Text13Regular } from '../base/text';
import { OnboardingRow } from './OnboardingRow';
import { OnboardingStepUI } from './types';

export interface Props {
  data: OnboardingStepUI['data'];
  isCompleted?: boolean;
  showDescription?: boolean;
  showCheckbox?: boolean;
}

export const OnboardingStepLayout: FC<Props> = (props) => {
  const { data, isCompleted = false, showDescription = false, showCheckbox } = props;
  const { title, description, content } = data;
  // Widget Variant
  const mainColor = isCompleted ? 'var(--fg-muted)' : 'var(--fg-primary)';
  return (
    <OnboardingRow>
      <Stack gap="xs" style={{ flex: 1, minWidth: 0, maxWidth: 300 }}>
        <Group>
          {showCheckbox && (
            <Box
              miw={20}
              h={16}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 16,
                  height: 16,
                  border: `1px solid ${isCompleted ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-gray-9)'}`,
                  backgroundColor: isCompleted ? 'var(--mantine-color-green-6)' : 'rgba(43, 45, 49, 1)',
                }}
              >
                {isCompleted && <CheckIcon size={12} style={{ color: 'black' }} />}
              </Box>
            </Box>
          )}
          <Text13Regular c={mainColor} style={isCompleted ? { textDecoration: 'line-through' } : undefined}>
            {title}
          </Text13Regular>
        </Group>

        {/* */}
        {showDescription && (
          <Group align="flex-start" wrap="nowrap">
            {showCheckbox && <Box miw={20} h={16} style={{ flexShrink: 0 }} />}
            <Stack gap="md">
              {description && (
                <Text13Regular c="var(--fg-muted)" style={{ whiteSpace: 'normal', wordWrap: 'break-word' }}>
                  {description}
                </Text13Regular>
              )}
              {content?.()}
            </Stack>
          </Group>
        )}
      </Stack>
    </OnboardingRow>
  );
};
