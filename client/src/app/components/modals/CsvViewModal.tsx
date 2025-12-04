'use client';
import { CsvDataResponse, uploadsApi } from '@/lib/api/uploads';
import { Center, Group, Loader, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { FC, useEffect, useState } from 'react';
import { formatNumber } from '../../../utils/helpers';
import { ButtonSecondaryOutline } from '../base/buttons';
import { ModalWrapper } from '../ModalWrapper';

interface CsvViewModalProps {
  opened: boolean;
  onClose: () => void;
  uploadId: string | null;
  uploadName: string | null;
}

export const CsvViewModal: FC<CsvViewModalProps> = ({ opened, onClose, uploadId, uploadName }) => {
  const [data, setData] = useState<CsvDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened && uploadId) {
      setIsLoading(true);
      setError(null);
      uploadsApi
        .getCsvData(uploadId, 100, 0) // Fetch first 100 rows
        .then((result) => {
          setData(result);
        })
        .catch((err) => {
          console.error('Failed to load CSV data:', err);
          setError('Failed to load CSV data');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [opened, uploadId]);

  if (!data && !isLoading && !error) return null;

  // Get column names from the first row
  const columnNames = data && data.rows.length > 0 ? Object.keys(data.rows[0]).filter((key) => key !== 'remoteId') : [];

  return (
    <ModalWrapper
      customProps={{
        footer: <ButtonSecondaryOutline onClick={onClose}>Close</ButtonSecondaryOutline>,
      }}
      opened={opened}
      onClose={onClose}
      title={`Preview: ${uploadName || 'CSV Upload'}`}
      size="xl"
    >
      <Stack gap="md" align="stretch" h={500} justify="center">
        {isLoading && (
          <Center>
            <Loader />
          </Center>
        )}

        {error && (
          <Center>
            <Text c="red">{error}</Text>
          </Center>
        )}

        {data && !isLoading && (
          <>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Previewing {formatNumber(data.rows.length)} of {formatNumber(data.total)} rows.{' '}
                {data.total > data.rows.length ? 'Download the full CSV to see all rows.' : ''}
              </Text>
            </Group>

            <ScrollArea>
              <Table highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    {columnNames.map((name) => (
                      <Table.Th key={name}>
                        <Text size="sm" fw={600}>
                          {name}
                        </Text>
                      </Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.rows.map((row, rowIndex) => (
                    <Table.Tr key={rowIndex}>
                      {columnNames.map((colName) => (
                        <Table.Td key={`${rowIndex}-${colName}`}>
                          <Text size="sm" lineClamp={1}>
                            {row[colName] != null ? String(row[colName]) : ''}
                          </Text>
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </>
        )}
      </Stack>
    </ModalWrapper>
  );
};
