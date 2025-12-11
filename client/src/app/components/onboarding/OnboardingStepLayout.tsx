import { Box, Group, Stack } from '@mantine/core';
import { Square, SquareCheck } from 'lucide-react';
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
      <Stack gap={0} style={{ flex: 1, minWidth: 0, maxWidth: 300 }}>
        <Group>
          {showCheckbox && (
            <Box miw={20} h={16} style={{ flexShrink: 0 }}>
              {isCompleted ? <SquareCheck size={16} color="white" /> : <Square size={16} color="white" />}
            </Box>
          )}
          <Text13Regular c={mainColor}>{title}</Text13Regular>
        </Group>

        {/* */}
        {showDescription && (
          <Group align="flex-start" wrap="nowrap">
            {showCheckbox && <Box miw={20} h={16} style={{ flexShrink: 0 }} />}
            <Stack>
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
