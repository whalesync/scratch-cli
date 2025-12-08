import { Box, Checkbox, Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { Check } from 'lucide-react';
import { ReactNode } from 'react';

export interface OnboardingStepProps {
  title: string;
  description?: string;
  isCompleted?: boolean;
  isActive?: boolean; // Expanded state in widget
  onToggle?: () => void; // Click handler
  variant?: 'widget' | 'standalone';
  children?: ReactNode; // For extra content like examples/shortcuts
}

export const OnboardingStep = ({
  title,
  description,
  isCompleted = false,
  isActive = false,
  onToggle,
  variant = 'widget',
  children,
}: OnboardingStepProps) => {
  if (variant === 'standalone') {
    return (
      <Stack gap={4}>
        <Group>
          <Checkbox checked={isCompleted} readOnly color="teal" radius="xs" />
          <Text fw={500} size="sm" td={isCompleted ? 'line-through' : undefined} c="dimmed">
            {title}
          </Text>
        </Group>
        {description && (
          <Text size="xs" c="dimmed" pl={28}>
            {description}
          </Text>
        )}
      </Stack>
    );
  }

  // Widget Variant
  return (
    <Box>
      <UnstyledButton onClick={onToggle} w="100%" display="block">
        <Group align="flex-start" wrap="nowrap" gap="sm">
          <Box pt={2}>
            {/* Custom Checkbox Look */}
            <Box
              w={16}
              h={16}
              style={{
                borderRadius: 2,
                backgroundColor: isCompleted ? 'var(--mantine-color-teal-6)' : 'transparent',
                border: isCompleted ? 'none' : '1px solid var(--mantine-color-dark-4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              {isCompleted && <Check size={12} color="black" strokeWidth={4} />}
            </Box>
          </Box>

          <Stack gap={2} style={{ flex: 1 }}>
            <Text
              size="sm"
              fw={500}
              c={isCompleted ? 'dimmed' : 'white'}
              td={isCompleted ? 'line-through' : undefined}
              style={{ transition: 'color 0.2s' }}
            >
              {title}
            </Text>

            <Collapse in={isActive}>
              <Stack gap="sm" pt={4} pb={8}>
                {description && (
                  <Text size="sm" c="dimmed" lh={1.4}>
                    {description}
                  </Text>
                )}
                {children}
              </Stack>
            </Collapse>
          </Stack>
        </Group>
      </UnstyledButton>
    </Box>
  );
};
