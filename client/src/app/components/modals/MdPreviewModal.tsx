'use client';

import { SWR_KEYS } from '@/lib/api/keys';
import { MdPreviewResponse, uploadsApi } from '@/lib/api/uploads';
import { Badge, Box, Button, Code, Group, Modal, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { RouteUrls } from '../../../utils/route-urls';

interface MdPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  data: MdPreviewResponse | null;
  fileName?: string;
  file: File | null;
}

export const MdPreviewModal = ({ opened, onClose, data, fileName, file }: MdPreviewModalProps) => {
  const [isImporting, setIsImporting] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useSWRConfig();

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    try {
      console.debug('Importing markdown file:', fileName);

      const result = await uploadsApi.uploadMarkdown(file);
      console.debug('Markdown uploaded successfully:', result);

      notifications.show({
        title: 'Success',
        message: `Markdown file "${fileName}" uploaded successfully`,
        color: 'green',
      });

      // Invalidate uploads list cache (this will refresh the page if using SWR)
      await mutate(SWR_KEYS.uploads.list());

      // Close modal
      onClose();

      // Navigate to resoruces page only if not already there
      if (pathname !== RouteUrls.resourcesPageUrl) {
        router.push(RouteUrls.resourcesPageUrl);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to upload Markdown file',
        color: 'red',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string':
        return 'blue';
      case 'number':
        return 'green';
      case 'boolean':
        return 'orange';
      case 'array':
        return 'violet';
      case 'object':
        return 'grape';
      case 'date':
        return 'cyan';
      case 'null':
      case 'undefined':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  if (!data) return null;

  const frontMatterKeys = Object.keys(data.data);
  const contentPreview = data.PAGE_CONTENT.slice(0, 500);
  const isTruncated = data.PAGE_CONTENT.length > 500;
  const contentLines = data.PAGE_CONTENT.split('\n').length;
  const contentChars = data.PAGE_CONTENT.length;

  return (
    <Modal opened={opened} onClose={onClose} title="Preview: Markdown File" size="xl" centered>
      <Stack gap="lg">
        {/* Filename display */}
        <Text size="sm" fw={500}>
          File: {fileName}
        </Text>

        {/* Front Matter Section */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            Front Matter{' '}
            <Text span size="sm" fw={400} c="dimmed">
              ({frontMatterKeys.length} {frontMatterKeys.length === 1 ? 'field' : 'fields'})
            </Text>
          </Text>
          <ScrollArea h={300} offsetScrollbars>
            <Table highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w="30%">Field</Table.Th>
                  <Table.Th w="15%">Type</Table.Th>
                  <Table.Th w="55%">Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {frontMatterKeys.map((key) => {
                  const field = data.data[key];
                  return (
                    <Table.Tr key={key}>
                      <Table.Td>
                        <Text fw={500} size="sm">
                          {key}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getTypeColor(field.type)} size="sm" variant="light">
                          {field.type}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Code block={typeof field.value === 'object'} style={{ fontSize: '11px' }}>
                          {formatValue(field.value)}
                        </Code>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Box>

        {/* Content Preview Section */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            Content Preview{' '}
            <Text span size="sm" fw={400} c="dimmed">
              ({contentLines} {contentLines === 1 ? 'line' : 'lines'}, {contentChars} characters)
            </Text>
          </Text>
          <ScrollArea h={300} offsetScrollbars>
            <Code block style={{ fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {contentPreview}
              {isTruncated && '\n\n... (content truncated)'}
            </Code>
          </ScrollArea>
        </Box>

        {/* Import button */}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} loading={isImporting}>
            Import
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
