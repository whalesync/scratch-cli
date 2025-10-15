'use client';

import { MdDataResponse, uploadsApi } from '@/lib/api/uploads';
import { Badge, Box, Center, Code, Group, Loader, Modal, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { FC, useEffect, useState } from 'react';

interface MdViewModalProps {
  opened: boolean;
  onClose: () => void;
  uploadId: string | null;
  uploadName: string | null;
}

export const MdViewModal: FC<MdViewModalProps> = ({ opened, onClose, uploadId, uploadName }) => {
  const [data, setData] = useState<MdDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (opened && uploadId) {
      setIsLoading(true);
      setError(null);
      uploadsApi
        .getMdData(uploadId)
        .then((result) => {
          setData(result);
        })
        .catch((err) => {
          console.error('Failed to load Markdown data:', err);
          setError('Failed to load Markdown data');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [opened, uploadId]);

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

  if (!data && !isLoading && !error) return null;

  const frontMatterKeys = data?.data ? Object.keys(data.data) : [];
  const contentPreview = data?.PAGE_CONTENT?.slice(0, 500) || '';
  const isTruncated = (data?.PAGE_CONTENT?.length || 0) > 500;
  const contentLines = data?.PAGE_CONTENT?.split('\n').length || 0;
  const contentChars = data?.PAGE_CONTENT?.length || 0;

  return (
    <Modal opened={opened} onClose={onClose} title={`Preview: ${uploadName || 'Markdown Upload'}`} size="xl" centered>
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
            {/* Front Matter Section */}
            {frontMatterKeys.length > 0 && (
              <Box>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={600}>
                    Front Matter ({frontMatterKeys.length} {frontMatterKeys.length === 1 ? 'field' : 'fields'})
                  </Text>
                </Group>
                <ScrollArea h={200}>
                  <Table highlightOnHover withTableBorder withColumnBorders>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w="30%">Key</Table.Th>
                        <Table.Th w="20%">Type</Table.Th>
                        <Table.Th w="50%">Value</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {frontMatterKeys.map((key) => {
                        const fieldData = data.data[key];
                        const value =
                          typeof fieldData === 'object' && fieldData !== null && 'value' in fieldData
                            ? (fieldData as Record<string, unknown>).value
                            : fieldData;
                        const type =
                          typeof fieldData === 'object' && fieldData !== null && 'type' in fieldData
                            ? String((fieldData as Record<string, unknown>).type)
                            : typeof value;

                        return (
                          <Table.Tr key={key}>
                            <Table.Td>
                              <Text size="sm" fw={500}>
                                {key}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge color={getTypeColor(String(type))} variant="light" size="sm">
                                {String(type)}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Code block style={{ fontSize: '12px', maxHeight: '100px', overflow: 'auto' }}>
                                {formatValue(value)}
                              </Code>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              </Box>
            )}

            {/* Content Section */}
            <Box>
              <Group justify="space-between" mb="xs">
                <Text size="sm" fw={600}>
                  Content
                </Text>
                <Text size="xs" c="dimmed">
                  {contentLines} {contentLines === 1 ? 'line' : 'lines'}, {contentChars} characters
                </Text>
              </Group>
              <ScrollArea h={300}>
                <Code block style={{ fontSize: '12px' }}>
                  {contentPreview}
                  {isTruncated && '\n\n... (truncated)'}
                </Code>
              </ScrollArea>
              {isTruncated && (
                <Text size="xs" c="dimmed" mt="xs">
                  Preview truncated. Full content available in the upload.
                </Text>
              )}
            </Box>
          </>
        )}
      </Stack>
    </Modal>
  );
};
