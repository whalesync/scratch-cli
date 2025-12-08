import { Box, CloseButton, Group, Kbd, Paper, Stack, Text } from '@mantine/core';
import { ArrowUp } from 'lucide-react';
import { ReactNode, useMemo, useState } from 'react';
import { OnboardingStep } from './OnboardingStep';

export interface StepData {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  content?: ReactNode;
}

interface OnboardingWidgetProps {
  steps: StepData[];
  onClose?: () => void;
  onToggleStep?: (id: string) => void;
}

export const OnboardingWidget = ({ steps, onClose, onToggleStep }: OnboardingWidgetProps) => {
  // Logic: First non-performed expanded.
  // We can track the expanded state internally, initialized by the first non-completed.
  // Or we can just let the standard behavior rule.

  // Find the index of the first incomplete step
  const firstIncompleteIndex = useMemo(() => {
    const idx = steps.findIndex((s) => !s.isCompleted);
    return idx === -1 ? steps.length - 1 : idx; // If all complete, maybe show last? or none?
  }, [steps]);

  const [expandedStepId, setExpandedStepId] = useState<string | null>(steps[firstIncompleteIndex]?.id || null);

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const totalCount = steps.length;

  return (
    <Paper
      w={320}
      radius="sm"
      bg="dark.8"
      withBorder
      style={{ borderColor: 'var(--mantine-color-dark-4)', overflow: 'hidden' }}
    >
      {/* Header */}
      <Box p="xs" pb={8} style={{ borderBottom: '1px dashed var(--mantine-color-blue-5)' }}>
        <Group justify="space-between" align="center">
          <Group gap={8}>
            <Text size="sm" fw={600} c="white">
              Getting started
            </Text>
            <Text size="xs" c="dimmed">
              {completedCount}/{totalCount}
            </Text>
          </Group>
          <CloseButton size="xs" onClick={onClose} variant="transparent" c="dimmed" />
        </Group>
      </Box>

      {/* Steps List */}
      <Stack gap={0}>
        {steps.map((step, index) => {
          const isExpanded = expandedStepId === step.id;
          const isLast = index === steps.length - 1;

          return (
            <Box
              key={step.id}
              style={{
                borderBottom: isLast ? 'none' : '1px dashed var(--mantine-color-blue-5)',
                backgroundColor: isExpanded ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
              }}
              p="xs"
            >
              <OnboardingStep
                title={step.title}
                description={step.description}
                isCompleted={step.isCompleted}
                isActive={isExpanded}
                onToggle={() => {
                  setExpandedStepId(isExpanded ? null : step.id);
                  onToggleStep?.(step.id);
                }}
              >
                {step.content}
              </OnboardingStep>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
};

// Helper component for the shortcuts shown in the screenshot,
// can be used as 'content' for the steps.
export const ShortcutsContent = () => {
  const ShortcutRow = ({ label, keys }: { label: string; keys: ReactNode }) => (
    <Group justify="space-between" align="center" py={4}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Group gap={4}>{keys}</Group>
    </Group>
  );

  return (
    <Box mt={4}>
      <Text size="xs" c="dimmed" mb={8} fw={500} tt="uppercase" style={{ letterSpacing: '0.5px' }}>
        Shortcuts
      </Text>
      <ShortcutRow
        label="Accept suggestion"
        keys={
          <>
            <Kbd size="xs">~</Kbd>
            <Kbd size="xs">RETURN</Kbd>
          </>
        }
      />
      <ShortcutRow
        label="Reject suggestion"
        keys={
          <>
            <Kbd size="xs">~</Kbd>
            <Kbd size="xs" w={60} ta="center">
              BACKSPACE
            </Kbd>
          </>
        }
      />
      <ShortcutRow label="Open field" keys={<Kbd size="xs">RETURN</Kbd>} />
      <ShortcutRow
        label="Open record"
        keys={
          <>
            <Kbd size="xs">
              <ArrowUp size={10} />
            </Kbd>
            <Kbd size="xs">RETURN</Kbd>
          </>
        }
      />
    </Box>
  );
};
