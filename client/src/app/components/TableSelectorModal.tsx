import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Group, Modal, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import { TableSelection, TableSelectionComponent } from './TableSelectionComponent';

interface TableSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tableIds: string[]) => void;
  tables: SnapshotTable[];
  currentTableId: string;
  title: string;
  description?: string;
  confirmButtonText?: string;
}

export const TableSelectorModal = ({
  isOpen,
  onClose,
  onConfirm,
  tables,
  currentTableId,
  title,
  description,
  confirmButtonText = 'Continue',
}: TableSelectorModalProps) => {
  const [tableSelection, setTableSelection] = useState<TableSelection>({
    mode: 'current',
    tableIds: [currentTableId],
  });

  const handleConfirm = () => {
    onConfirm(tableSelection.tableIds);
  };

  const handleClose = () => {
    // Reset selection when closing
    setTableSelection({
      mode: 'current',
      tableIds: [currentTableId],
    });
    onClose();
  };

  return (
    <Modal opened={isOpen} onClose={handleClose} title={title} centered size="lg">
      <Stack>
        {description && <Text>{description}</Text>}

        <TableSelectionComponent
          tables={tables}
          currentTableId={currentTableId}
          onChange={setTableSelection}
          initialSelection={tableSelection}
        />

        <Group justify="flex-end">
          <ButtonSecondaryOutline onClick={handleClose}>Cancel</ButtonSecondaryOutline>
          <ButtonPrimaryLight onClick={handleConfirm} disabled={tableSelection.tableIds.length === 0}>
            {confirmButtonText}
          </ButtonPrimaryLight>
        </Group>
      </Stack>
    </Modal>
  );
};
