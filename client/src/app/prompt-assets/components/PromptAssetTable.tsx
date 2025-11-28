import { ActionIconThreeDots } from '@/app/components/base/action-icons';
import { Badge } from '@/app/components/base/badge';
import { DecorativeBoxedIcon } from '@/app/components/Icons/DecorativeBoxedIcon';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import {
  GenericDeleteConfirmationModal,
  useDeleteConfirmationModal,
} from '@/app/components/modals/GenericDeleteConfirmationModal';
import { RelativeDate } from '@/app/components/RelativeDate';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { usePromptAssets } from '@/hooks/use-prompt-assets';
import { styleGuideApi } from '@/lib/api/style-guide';
import { trackClickDownloadResource } from '@/lib/posthog';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { formatBytes } from '@/utils/helpers';
import { Alert, Group, Menu, Paper, Table } from '@mantine/core';
import { StyleGuideId } from '@spinner/shared-types';
import { capitalize } from 'lodash';
import { DownloadIcon, Edit3Icon, FileTextIcon, LinkIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';

export const PromptAssetTable = ({ openEditModal }: { openEditModal: (resource: StyleGuide) => void }) => {
  const { promptAssets, isLoading, error, mutate, deleteAsset } = usePromptAssets();
  const deleteModal = useDeleteConfirmationModal<StyleGuideId>();

  // TODO: Refactor.
  const [isExternalResourceUpdating, setIsExternalResourceUpdating] = useState(false);

  const handleUpdateExternalResource = async (id: string) => {
    try {
      setIsExternalResourceUpdating(true);
      await styleGuideApi.updateExternalResource(id);
      trackClickDownloadResource();
      await mutate();
      ScratchpadNotifications.success({
        title: 'External resource updated',
        message: 'The external resource has been updated',
      });
    } catch (error) {
      console.log('Error updating external resource:', error);
      ScratchpadNotifications.error({
        title: 'Failed to update external resource',
        message: 'Please try again',
      });
    } finally {
      setIsExternalResourceUpdating(false);
    }
  };

  const sortedResources = promptAssets.sort((a, b) => a.name.localeCompare(b.name));

  if (isLoading) {
    return <LoaderWithMessage message="Loading..." />;
  }
  if (error) {
    return (
      <Paper p="md">
        <Alert color="red" title="Error">
          Failed to load Prompt assets
        </Alert>
      </Paper>
    );
  }

  return (
    <>
      <GenericDeleteConfirmationModal
        title="Delete asset"
        onConfirm={async (id) => await deleteAsset(id)}
        {...deleteModal}
      />

      <Table highlightOnHover>
        <Table.Thead>
          <Table.Tr h="30px">
            <Table.Td w="50%">Name</Table.Td>
            <Table.Td w="15%">File size</Table.Td>
            <Table.Td w="10%">Kind</Table.Td>
            <Table.Td w="15%">Created</Table.Td>
            <Table.Td w="10%" align="right">
              {/* Actions */}
            </Table.Td>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sortedResources.map((styleGuide) => (
            <PromptAssetRow
              key={styleGuide.id}
              styleGuide={styleGuide}
              openEditModal={openEditModal}
              onDeleteClick={() => deleteModal.open(styleGuide.id, styleGuide.name)}
              handleUpdateExternalResource={handleUpdateExternalResource}
              isExternalResourceUpdating={isExternalResourceUpdating}
            />
          ))}
        </Table.Tbody>
      </Table>
    </>
  );
};

const PromptAssetRow = ({
  styleGuide,
  openEditModal,
  onDeleteClick,
  handleUpdateExternalResource,
  isExternalResourceUpdating,
}: {
  styleGuide: StyleGuide;
  openEditModal: (resource: StyleGuide) => void;
  onDeleteClick: (id: StyleGuideId, name: string) => void;
  handleUpdateExternalResource: (id: string) => void;
  isExternalResourceUpdating: boolean;
}) => {
  return (
    <Table.Tr key={styleGuide.id} onClick={() => openEditModal(styleGuide)} style={{ cursor: 'pointer' }} h="30px">
      <Table.Td h="30px">
        <Group gap="sm">
          <DecorativeBoxedIcon Icon={FileTextIcon} size="xs" />
          {styleGuide.name}
          {styleGuide.autoInclude ? <Badge color="green">Auto Include</Badge> : null}
          {styleGuide.sourceUrl && <Badge icon={LinkIcon}>External</Badge>}
          {styleGuide.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </Group>
      </Table.Td>
      <Table.Td>{formatBytes(styleGuide.body.length)}</Table.Td>
      <Table.Td>{capitalize(styleGuide.contentType)}</Table.Td>
      <Table.Td>
        <RelativeDate date={styleGuide.createdAt} />
      </Table.Td>
      <Table.Td align="right">
        <Menu>
          <Menu.Target>
            {/* Prevent the menu clicking the underlying table row */}
            <div onClick={(e) => e.stopPropagation()} style={{ width: 'fit-content' }}>
              <ActionIconThreeDots />
            </div>
          </Menu.Target>
          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
            <Menu.Item leftSection={<Edit3Icon size={16} />} onClick={() => openEditModal(styleGuide)}>
              Edit
            </Menu.Item>

            {styleGuide.sourceUrl && (
              <Menu.Item
                leftSection={<DownloadIcon size={16} />}
                onClick={() => handleUpdateExternalResource(styleGuide.id)}
                disabled={isExternalResourceUpdating}
              >
                {isExternalResourceUpdating ? 'Updating...' : 'Redownload external content'}
              </Menu.Item>
            )}
            <Menu.Divider />
            <Menu.Item
              data-delete
              leftSection={<Trash2 size={16} />}
              onClick={() => onDeleteClick(styleGuide.id, styleGuide.name)}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Table.Td>
    </Table.Tr>
  );
};
