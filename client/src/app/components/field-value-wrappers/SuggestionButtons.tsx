import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/workbook';
import { ActionIcon, Group, useMantineColorScheme } from '@mantine/core';
import { Check, X } from 'lucide-react';
import { FC, useState } from 'react';
import styles from './value/FieldValueWrapper.module.css';

type SuggestionButtonsProps = {
  record: SnapshotRecord;
  columnDef: TableSpec['columns'][0];
  acceptCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  // isLightMode: boolean;
};

export const SuggestionButtons: FC<SuggestionButtonsProps> = ({
  record,
  columnDef,
  acceptCellValues,
  rejectCellValues,
  // isLightMode,
}) => {
  const isLightMode = useMantineColorScheme().colorScheme === 'light';
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!acceptCellValues || isProcessing) return;
    try {
      setIsProcessing(true);
      await acceptCellValues([{ wsId: record.id.wsId, columnId: columnDef.id.wsId }]);
      ScratchpadNotifications.success({
        title: 'Suggestion Accepted',
        message: `Accepted suggestion for ${columnDef.name}`,
      });
    } catch (error) {
      console.error('Error accepting suggestion:', error);
      ScratchpadNotifications.error({
        title: 'Error accepting suggestion',
        message: error instanceof Error ? error.message : 'Failed to accept suggestion',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!rejectCellValues || isProcessing) return;

    try {
      setIsProcessing(true);
      await rejectCellValues([{ wsId: record.id.wsId, columnId: columnDef.id.wsId }]);
      ScratchpadNotifications.success({
        title: 'Suggestion Rejected',
        message: `Rejected suggestion for ${columnDef.name}`,
      });
    } catch (error) {
      console.error('Error rejecting suggestion:', error);
      ScratchpadNotifications.error({
        title: 'Error rejecting suggestion',
        message: error instanceof Error ? error.message : 'Failed to reject suggestion',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Group
      gap={3}
      style={{
        position: 'absolute',
        right: '0px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
        backgroundColor: isLightMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(5px)',
        padding: '5px',
      }}
      className={styles.suggestionButtons}
    >
      <ActionIcon
        size="xs"
        variant="light"
        color="var(--fg-reject)"
        bg="var(--bg-reject)"
        onClick={handleReject}
        disabled={isProcessing}
      >
        <X size={10} />
      </ActionIcon>
      <ActionIcon
        size="xs"
        color="var(--fg-accept)"
        bg="var(--bg-accept)"
        onClick={handleAccept}
        disabled={isProcessing}
      >
        <Check size={10} />
      </ActionIcon>
    </Group>
  );
};
