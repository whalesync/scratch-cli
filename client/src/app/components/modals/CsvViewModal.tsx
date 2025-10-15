'use client';
import { CsvDataResponse, uploadsApi } from '@/lib/api/uploads';
import { Center, Group, Loader, Modal, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { FC, useEffect, useState } from 'react';

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
    <Modal opened={opened} onClose={onClose} title={`Preview: ${uploadName || 'CSV Upload'}`} size="xl" centered>
      <Stack gap="md">
        {isLoading && (
          <Center h={200}>
            <Loader />
          </Center>
        )}

        {error && (
          <Center h={200}>
            <Text c="red">{error}</Text>
          </Center>
        )}

        {data && !isLoading && (
          <>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Showing {data.rows.length} of {data.total} rows
              </Text>
            </Group>

            <ScrollArea h={400}>
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

            {data.total > 100 && (
              <Text size="xs" c="dimmed" ta="center">
                Only showing first 100 rows. Download the full CSV to see all {data.total} rows.
              </Text>
            )}
          </>
        )}
      </Stack>
    </Modal>
  );
};
