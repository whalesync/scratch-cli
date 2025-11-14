import { Box, Code, Divider, Group, Kbd, Modal, ModalProps, Stack, Text } from '@mantine/core';
import { ButtonSecondaryOutline } from './base/buttons';
import { Text13Regular, TextTitle3 } from './base/text';

export const KeyboardShortcutHelpModal = (props: ModalProps) => {
  const shortcutsContent = (
    <Stack gap="md">
      {/* Grid Navigation */}
      <Box>
        <TextTitle3 mb="xs">Grid Navigation</TextTitle3>
        <Stack gap="xs">
          <Group justify="space-between">
            <Text13Regular>Open record details</Text13Regular>
            <Kbd>Enter</Kbd>
          </Group>
          <Group justify="space-between">
            <Text13Regular>Close record details</Text13Regular>
            <Kbd>Escape</Kbd>
          </Group>
          <Group justify="space-between">
            <Text13Regular>Copy cell value</Text13Regular>
            <Group gap="xs">
              <Kbd>Ctrl</Kbd>
              <Text>+</Text>
              <Kbd>C</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <Text13Regular>Navigate between records</Text13Regular>
            <Group gap="xs">
              <Kbd>↑</Kbd>
              <Text size="xs" c="dimmed">
                or
              </Text>
              <Kbd>↓</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <Text13Regular>Navigate between columns</Text13Regular>
            <Group gap="xs" wrap="nowrap">
              <Kbd>←</Kbd>
              <Text size="xs" c="dimmed">
                or
              </Text>
              <Kbd>→</Kbd>
            </Group>
          </Group>

          <Group justify="space-between">
            <Text13Regular>Toggle max column width</Text13Regular>
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
            <Text13Regular mb="xs">Open this help modal</Text13Regular>
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
            <Text13Regular>Send message</Text13Regular>
            <Kbd>Enter</Kbd>
          </Group>
          <Group justify="space-between">
            <Text13Regular>New line in message</Text13Regular>
            <Group gap="xs">
              <Kbd>Shift</Kbd>
              <Text>+</Text>
              <Kbd>Enter</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <Text13Regular>Attach a resource to the session</Text13Regular>
            <Group gap="xs">
              <Kbd>Ctrl</Kbd>
              <Text>+</Text>
              <Kbd>Enter</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <Text13Regular>New session</Text13Regular>
            <Group gap="xs">
              <Text>type </Text>
              <Code>/new</Code>
            </Group>
          </Group>
          <Group justify="space-between">
            <Text13Regular>Clear local history</Text13Regular>
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
