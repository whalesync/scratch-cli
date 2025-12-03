import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotRecord, TableSpec } from '@/types/server-entities/workbook';
import { Box, Group, MantineStyleProps } from '@mantine/core';
import { CheckIcon, XIcon } from 'lucide-react';
import { FC, useState } from 'react';
import { IconButtonOutline, IconButtonPrimaryOutline } from '../base/buttons';
import { StyledLucideIcon } from '../Icons/StyledLucideIcon';
import styles from './value/FieldValueWrapper.module.css';

/** Only UI for showing a small accept/reject button pair. */
export const InlineSuggestionButtons: FC<
  {
    onAcceptClick: () => void;
    onRejectClick: () => void;
    disabled: boolean;
  } & MantineStyleProps
> = ({ onAcceptClick, onRejectClick, disabled, ...styleProps }) => {
  return (
    <Group gap="xs" justify="flex-end" mx={0} {...styleProps}>
      <IconButtonOutline
        size="compact-sm"
        bg="var(--bg-base)"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRejectClick();
        }}
      >
        <XIcon size={13} />
      </IconButtonOutline>
      <IconButtonPrimaryOutline
        size="compact-sm"
        bg="var(--bg-base)"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAcceptClick();
        }}
      >
        <StyledLucideIcon Icon={CheckIcon} size={13} c="var(--mantine-color-green-6)" />
      </IconButtonPrimaryOutline>
    </Group>
  );
};

type SuggestionButtonsProps = {
  record: SnapshotRecord;
  columnDef: TableSpec['columns'][0];
  acceptCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>;
};

export const SuggestionButtons: FC<SuggestionButtonsProps> = ({
  record,
  columnDef,
  acceptCellValues,
  rejectCellValues,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAccept = async () => {
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

  const handleReject = async () => {
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
    <Box
      className={styles.suggestionButtons}
      style={{
        position: 'absolute',
        right: '0px',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 1000,
      }}
    >
      <InlineSuggestionButtons onAcceptClick={handleAccept} onRejectClick={handleReject} disabled={isProcessing} />
    </Box>
  );
};
