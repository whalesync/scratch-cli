import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { ActionIcon, Code, Group, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { Copy } from 'lucide-react';

interface RecordJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: SnapshotRecord | null;
}

export const RecordJsonModal = ({ isOpen, onClose, record }: RecordJsonModalProps) => {
  const clipboard = useClipboard();

  if (!record) return null;

  const jsonData = JSON.stringify(record, null, 2);

  const handleCopyJson = () => {
    clipboard.copy(jsonData);
  };

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={
        <Group justify="space-between" align="center" style={{ width: '100%' }}>
          <Text fw={500}>Record Data (JSON)</Text>
          <ActionIcon variant="subtle" onClick={handleCopyJson} title={clipboard.copied ? 'Copied!' : 'Copy JSON'}>
            <StyledLucideIcon Icon={Copy} size={16} />
          </ActionIcon>
        </Group>
      }
      centered
      size="lg"
    >
      <Stack>
        <Text size="sm" c="dimmed">
          Record ID: <Code>{record.id.wsId}</Code>
        </Text>

        <ScrollArea h={400}>
          <Code
            block
            style={{
              fontSize: '12px',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {jsonData}
          </Code>
        </ScrollArea>

        <Group justify="flex-end">
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <PrimaryButton onClick={handleCopyJson}>{clipboard.copied ? 'Copied!' : 'Copy JSON'}</PrimaryButton>
        </Group>
      </Stack>
    </Modal>
  );
};
