'use client';

import { workbookApi } from '@/lib/api/workbook';
import { Group, Modal, ScrollArea, Table, Text, Title } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import { LinkIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface RefIndexEntry {
  id: string;
  workbookId: string;
  sourceFilePath: string;
  targetFolderPath: string;
  targetFileName: string | null;
  targetFileRecordId: string | null;
  branch: string;
}

interface RefIndexModalProps {
  opened: boolean;
  onClose: () => void;
  workbookId: WorkbookId;
}

export function RefIndexModal({ opened, onClose, workbookId }: RefIndexModalProps) {
  const [rows, setRows] = useState<RefIndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!opened) return;
    setIsLoading(true);
    workbookApi
      .listRefIndex(workbookId)
      .then((data) => setRows(data as RefIndexEntry[]))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [opened, workbookId]);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <LinkIcon size={18} />
          <Title order={4}>Ref Index</Title>
          <Text size="sm" c="dimmed">
            ({rows.length} entries)
          </Text>
        </Group>
      }
      size="xl"
    >
      {isLoading ? (
        <Text size="sm" c="dimmed" ta="center" py="md">
          Loading...
        </Text>
      ) : (
        <ScrollArea h={500}>
          <Table stickyHeader highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Source</Table.Th>
                <Table.Th>Target Folder</Table.Th>
                <Table.Th>Target File</Table.Th>
                <Table.Th>Target Record ID</Table.Th>
                <Table.Th>Branch</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No entries.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                rows.map((r) => (
                  <Table.Tr key={r.id}>
                    <Table.Td>
                      <Text size="xs" ff="monospace">
                        {r.sourceFilePath}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace">
                        {r.targetFolderPath}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace">
                        {r.targetFileName ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" ff="monospace">
                        {r.targetFileRecordId ?? '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {r.branch}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Modal>
  );
}
