import { darkOnDarkBorder, darkOnDarkMutedBg } from '@/app/components/onboarding/constants';
import { ActionIcon, Box, CheckIcon, Group, Stack } from '@mantine/core';
import { XIcon } from 'lucide-react';
import { FC } from 'react';
import { Text13Regular } from '../base/text';
import { OnboardingRow } from './OnboardingRow';
import { OnboardingStepUI } from './types';

export interface Props {
  data: OnboardingStepUI['data'];
  isCompleted?: boolean;
  showDescription?: boolean;
  showCheckbox?: boolean;
  onClose?: () => void;
}

export const OnboardingStepLayout: FC<Props> = (props) => {
  const { data, isCompleted = false, showDescription = false, showCheckbox, onClose } = props;
  const { title, description, content } = data;
  // Widget Variant
  const mainColor = isCompleted ? 'var(--fg-muted)' : 'var(--fg-primary)';
  return (
    <OnboardingRow>
      <Stack gap="xs" style={{ flex: 1, minWidth: 0, maxWidth: 300 }}>
        <Group justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
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
                    border: `1px solid ${isCompleted ? 'var(--mantine-color-green-6)' : darkOnDarkBorder}`,
                    backgroundColor: isCompleted ? 'var(--mantine-color-green-6)' : darkOnDarkMutedBg,
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
          {onClose && (
            <ActionIcon variant="subtle" size="sm" onClick={onClose} c="var(--fg-muted)">
              <XIcon size={16} />
            </ActionIcon>
          )}
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
