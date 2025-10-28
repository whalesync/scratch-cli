import { Box, Code, Divider, Group, Kbd, Modal, ModalProps, Stack, Text } from '@mantine/core';
import { ButtonSecondaryOutline } from './base/buttons';
import { TextSmRegular, TextTitle3 } from './base/text';

export const KeyboardShortcutHelpModal = (props: ModalProps) => {
  const shortcutsContent = (
    <Stack gap="md">
      {/* Grid Navigation */}
      <Box>
        <TextTitle3 mb="xs">Grid Navigation</TextTitle3>
        <Stack gap="xs">
          <Group justify="space-between">
            <TextSmRegular>Open record details</TextSmRegular>
            <Kbd>Enter</Kbd>
          </Group>
          <Group justify="space-between">
            <TextSmRegular>Close record details</TextSmRegular>
            <Kbd>Escape</Kbd>
          </Group>
          <Group justify="space-between">
            <TextSmRegular>Copy cell value</TextSmRegular>
            <Group gap="xs">
              <Kbd>Ctrl</Kbd>
              <Text>+</Text>
              <Kbd>C</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextSmRegular>Navigate between records</TextSmRegular>
            <Group gap="xs">
              <Kbd>↑</Kbd>
              <Text size="xs" c="dimmed">
                or
              </Text>
              <Kbd>↓</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextSmRegular>Navigate between columns</TextSmRegular>
            <Group gap="xs" wrap="nowrap">
              <Kbd>←</Kbd>
              <Text size="xs" c="dimmed">
                or
              </Text>
              <Kbd>→</Kbd>
            </Group>
          </Group>

          <Group justify="space-between">
            <TextSmRegular>Toggle max column width</TextSmRegular>
            <Group gap="xs">
              <Kbd>Ctrl</Kbd>
              <Text>+</Text>
              <Kbd>_</Kbd>
            </Group>
          </Group>
        </Stack>
      </Box>

      <Divider />

      {/* General */}
      <Box>
        <TextTitle3>General</TextTitle3>
        <Stack gap="xs">
          <Group justify="space-between">
            <TextSmRegular mb="xs">Open this help modal</TextSmRegular>
            <Group gap="xs">
              <Kbd>Ctrl</Kbd>
              <Text>+</Text>
              <Kbd>H</Kbd>
            </Group>
          </Group>
        </Stack>
      </Box>

      <Divider />

      {/* AI Chat */}
      <Box>
        <TextTitle3 mb="xs">Chat</TextTitle3>
        <Stack gap="xs">
          <Group justify="space-between">
            <TextSmRegular>Send message</TextSmRegular>
            <Kbd>Enter</Kbd>
          </Group>
          <Group justify="space-between">
            <TextSmRegular>New line in message</TextSmRegular>
            <Group gap="xs">
              <Kbd>Shift</Kbd>
              <Text>+</Text>
              <Kbd>Enter</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextSmRegular>Attach a resource to the session</TextSmRegular>
            <Group gap="xs">
              <Kbd>Ctrl</Kbd>
              <Text>+</Text>
              <Kbd>Enter</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextSmRegular>New session</TextSmRegular>
            <Group gap="xs">
              <Text>type </Text>
              <Code>/new</Code>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextSmRegular>Clear local history</TextSmRegular>
            <Group gap="xs">
              <Text>type </Text>
              <Code>/clear</Code>
            </Group>
          </Group>
        </Stack>
      </Box>
    </Stack>
  );

  return (
    <Modal title="Reference" size="lg" transitionProps={{ transition: 'fade', duration: 200 }} {...props}>
      {shortcutsContent}
      <Group justify="flex-end" mt="lg">
        <ButtonSecondaryOutline onClick={props.onClose}>Close</ButtonSecondaryOutline>
      </Group>
    </Modal>
  );
};
