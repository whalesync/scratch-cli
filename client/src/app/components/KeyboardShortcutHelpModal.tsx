import { Box, Code, Divider, Group, Kbd, Modal, ModalProps, Stack, Text } from '@mantine/core';
import { ButtonSecondaryOutline } from './base/buttons';
import { TextRegularSm, TextTitle3 } from './base/text';

export const KeyboardShortcutHelpModal = (props: ModalProps) => {
  const title = <TextTitle3>Reference</TextTitle3>;

  const shortcutsContent = (
    <Stack gap="md">
      {/* Grid Navigation */}
      <Box>
        <TextTitle3 mb="xs">Grid Navigation</TextTitle3>
        <Stack gap="xs">
          <Group justify="space-between">
            <TextRegularSm>Open record details</TextRegularSm>
            <Kbd>Enter</Kbd>
          </Group>
          <Group justify="space-between">
            <TextRegularSm>Close record details</TextRegularSm>
            <Kbd>Escape</Kbd>
          </Group>
          <Group justify="space-between">
            <TextRegularSm>Copy cell value</TextRegularSm>
            <Group gap="xs">
              <Kbd>Ctrl</Kbd>
              <Text>+</Text>
              <Kbd>C</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextRegularSm>Navigate between records</TextRegularSm>
            <Group gap="xs">
              <Kbd>↑</Kbd>
              <Text size="xs" c="dimmed">
                or
              </Text>
              <Kbd>↓</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextRegularSm>Navigate between columns</TextRegularSm>
            <Group gap="xs" wrap="nowrap">
              <Kbd>←</Kbd>
              <Text size="xs" c="dimmed">
                or
              </Text>
              <Kbd>→</Kbd>
            </Group>
          </Group>

          <Group justify="space-between">
            <TextRegularSm>Toggle max column width</TextRegularSm>
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
            <TextRegularSm mb="xs">Open this help modal</TextRegularSm>
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
            <TextRegularSm>Send message</TextRegularSm>
            <Kbd>Enter</Kbd>
          </Group>
          <Group justify="space-between">
            <TextRegularSm>New line in message</TextRegularSm>
            <Group gap="xs">
              <Kbd>Shift</Kbd>
              <Text>+</Text>
              <Kbd>Enter</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextRegularSm>Attach a resource to the session</TextRegularSm>
            <Group gap="xs">
              <Kbd>Ctrl</Kbd>
              <Text>+</Text>
              <Kbd>Enter</Kbd>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextRegularSm>New session</TextRegularSm>
            <Group gap="xs">
              <Text>type </Text>
              <Code>/new</Code>
            </Group>
          </Group>
          <Group justify="space-between">
            <TextRegularSm>Clear local history</TextRegularSm>
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
    <Modal title={title} size="lg" transitionProps={{ transition: 'fade', duration: 200 }} {...props}>
      {shortcutsContent}
      <Group justify="flex-end" mt="lg">
        <ButtonSecondaryOutline onClick={props.onClose}>Close</ButtonSecondaryOutline>
      </Group>
    </Modal>
  );
};
