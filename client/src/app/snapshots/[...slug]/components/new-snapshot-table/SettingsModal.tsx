import { Group, Modal, Stack, Switch, Text } from '@mantine/core';
import { Gear } from '@phosphor-icons/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkTheme: boolean;
  onThemeToggle: (isDark: boolean) => void;
  showDataTypeInHeader: boolean;
  onShowDataTypeToggle: (show: boolean) => void;
}

export const SettingsModal = ({
  isOpen,
  onClose,
  isDarkTheme,
  onThemeToggle,
  showDataTypeInHeader,
  onShowDataTypeToggle,
}: SettingsModalProps) => {
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Gear size={20} />
          <Text fw={600}>Table Settings</Text>
        </Group>
      }
      size="sm"
      centered
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Text size="sm">Dark Mode</Text>
          <Switch checked={isDarkTheme} onChange={(event) => onThemeToggle(event.currentTarget.checked)} size="md" />
        </Group>

        <Group justify="space-between">
          <Text size="sm">Show data type in column header</Text>
          <Switch
            checked={showDataTypeInHeader}
            onChange={(event) => onShowDataTypeToggle(event.currentTarget.checked)}
            size="md"
          />
        </Group>

        {/* Placeholder for future settings */}
        <Text size="xs" c="dimmed">
          More settings will be added here...
        </Text>
      </Stack>
    </Modal>
  );
};
