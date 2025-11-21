import { ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { TextTitle1 } from '@/app/components/base/text';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { LabelValuePair } from '@/app/components/LabelValuePair';
import { SnapshotRecord } from '@/types/server-entities/workbook';
import { ActionIcon, Code, Group, Modal, ScrollArea, Stack } from '@mantine/core';
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
          <TextTitle1>Record Data</TextTitle1>
          <ActionIcon variant="subtle" onClick={handleCopyJson} title={clipboard.copied ? 'Copied!' : 'Copy JSON'}>
            <StyledLucideIcon Icon={Copy} size={16} />
          </ActionIcon>
        </Group>
      }
      centered
      size="xl"
    >
      <Stack>
        <LabelValuePair label="Record ID" value={record.id.wsId} canCopy />
        <ScrollArea h={500}>
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
          <ButtonSecondaryOutline onClick={handleCopyJson}>
            {clipboard.copied ? 'Copied!' : 'Copy JSON'}
          </ButtonSecondaryOutline>
          <ButtonSecondaryOutline onClick={onClose}>Close</ButtonSecondaryOutline>
        </Group>
      </Stack>
    </Modal>
  );
};
