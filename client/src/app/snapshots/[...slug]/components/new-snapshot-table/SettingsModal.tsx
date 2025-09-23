import { Button, Group, Modal, Stack, Switch, Text } from '@mantine/core';
import { Gear, Trash } from '@phosphor-icons/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkTheme: boolean;
  onThemeToggle: () => void;
  showDataTypeInHeader: boolean;
  onShowDataTypeToggle: (show: boolean) => void;
  onClearColumnState: () => void;
}

export const SettingsModal = ({
  isOpen,
  onClose,
  isDarkTheme,
  onThemeToggle,
  showDataTypeInHeader,
  onShowDataTypeToggle,
  onClearColumnState,
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
          <Switch checked={isDarkTheme} onChange={onThemeToggle} size="md" />
        </Group>

        <Group justify="space-between">
          <Text size="sm">Show data type in column header</Text>
          <Switch
            checked={showDataTypeInHeader}
            onChange={(event) => onShowDataTypeToggle(event.currentTarget.checked)}
            size="md"
          />
        </Group>

        {/* Column State Management */}
        <Group justify="space-between">
          <div>
            <Text size="sm">Reset Column Layout</Text>
            <Text size="xs" c="dimmed">
              Clear saved column widths and positions
            </Text>
          </div>
          <Button variant="light" color="red" size="sm" leftSection={<Trash size={16} />} onClick={onClearColumnState}>
            Reset
          </Button>
        </Group>

        {/* Placeholder for future settings */}
        <Text size="xs" c="dimmed">
          More settings will be added here...
        </Text>
      </Stack>
    </Modal>
  );
};
