'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { uploadsApi } from '@/lib/api/uploads';
import { Alert, Center, Group, Loader, Modal, ModalProps, Radio, Stack, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

interface SelectTitleColumnModalProps extends Omit<ModalProps, 'children'> {
  uploadId: string;
  uploadName: string;
  onConfirm: (titleColumnRemoteId: string[]) => void;
}

export const SelectTitleColumnModal = ({ uploadId, uploadName, onConfirm, ...props }: SelectTitleColumnModalProps) => {
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (props.opened && uploadId) {
      loadColumns();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.opened, uploadId]);

  const loadColumns = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await uploadsApi.getCsvData(uploadId, 1, 0);
      if (data.rows.length > 0) {
        const columnNames = Object.keys(data.rows[0]);
        setColumns(columnNames);
        // Default to first column
        if (columnNames.length > 0) {
          setSelectedColumn(columnNames[0]);
        }
      } else {
        setError('No data found in CSV');
      }
    } catch (err) {
      console.error('Failed to load columns:', err);
      setError('Failed to load CSV columns');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedColumn) {
      // For CSV, the remoteId is just an array with the column name
      onConfirm([selectedColumn]);
    }
  };

  return (
    <Modal {...props} title={`Create workbook from "${uploadName}"`} centered size="md">
      <Stack>
        {error && (
          <Alert color="red" title="Error">
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Center h="200px">
            <Loader />
          </Center>
        ) : (
          <>
            <Text size="sm" c="dimmed">
              Select the column that should be used as the title/name for each record. This will be displayed as the
              primary identifier in the UI.
            </Text>

            <Radio.Group value={selectedColumn} onChange={setSelectedColumn}>
              <Stack gap="xs">
                {columns.map((column) => (
                  <Radio key={column} value={column} label={column} />
                ))}
              </Stack>
            </Radio.Group>

            <Group justify="flex-end" mt="md">
              <ButtonSecondaryOutline onClick={props.onClose}>Cancel</ButtonSecondaryOutline>
              <ButtonPrimaryLight onClick={handleConfirm} disabled={!selectedColumn}>
                Create workbook
              </ButtonPrimaryLight>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
};
