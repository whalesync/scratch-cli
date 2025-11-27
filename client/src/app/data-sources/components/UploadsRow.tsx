'use client';

import { Badge } from '@/app/components/base/badge';
import { Text13Medium } from '@/app/components/base/text';
import { Upload } from '@/lib/api/uploads';
import { Group, Menu, Table } from '@mantine/core';
import { Download, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { ActionIconThreeDots } from '../../components/base/action-icons';
import { ConnectorIcon } from '../../components/ConnectorIcon';
import { RelativeDate } from '../../components/RelativeDate';
import { ToolIconButton } from '../../components/ToolIconButton';

interface UploadsRowProps {
  upload: Upload;
  onView: (upload: Upload) => void;
  onCreateWorkbook: (upload: Upload) => void;
  onDownload: (upload: Upload) => void;
  onDelete: (upload: Upload) => void;
  isDownloading: boolean;
  isCreatingWorkbook: boolean;
}

export default function UploadsRow({
  upload,
  onView,
  onCreateWorkbook,
  onDownload,
  isDownloading,
  isCreatingWorkbook,
  onDelete,
}: UploadsRowProps) {
  return (
    <Table.Tr key={upload.id}>
      <Table.Td>
        <Link href="#" onClick={() => onView(upload)}>
          <Group gap="sm">
            <ConnectorIcon size={24} connector="csv" withBorder />
            <Text13Medium>{upload.name}</Text13Medium>
          </Group>
        </Link>
      </Table.Td>
      <Table.Td>{upload.type}</Table.Td>
      <Table.Td>
        <Badge>Uploaded</Badge>
      </Table.Td>
      <Table.Td>
        <RelativeDate date={upload.createdAt} />
      </Table.Td>
      <Table.Td align="right">
        <Group gap="xs" justify="flex-end">
          <ToolIconButton
            onClick={() => onCreateWorkbook(upload)}
            icon={Plus}
            tooltip="Create a workbook"
            loading={isCreatingWorkbook}
          />
          {upload.type === 'CSV' && (
            <ToolIconButton
              onClick={() => onDownload(upload)}
              icon={Download}
              tooltip="Download file"
              loading={isDownloading}
            />
          )}
          <Menu>
            <Menu.Target>
              <ActionIconThreeDots />
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item data-delete leftSection={<Trash2 size={16} />} onClick={() => onDelete(upload)}>
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
