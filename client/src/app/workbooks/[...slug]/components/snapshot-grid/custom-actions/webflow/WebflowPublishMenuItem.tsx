import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotRecord } from '@/types/server-entities/workbook';
import { SnapshotTable } from '@spinner/shared-types';
import { Menu } from '@mantine/core';
import { Upload } from 'lucide-react';
import React from 'react';
import { customWebflowActionsApi } from '../../../../../../../lib/api/custom-actions/webflow';

interface WebflowPublishMenuItemProps {
  selectedRows: SnapshotRecord[];
  currentTable: SnapshotTable;
  isProcessing: boolean;
  onClose: () => void;
  setIsProcessing: (value: boolean) => void;
}

export const WebflowPublishMenuItem: React.FC<WebflowPublishMenuItemProps> = ({
  selectedRows,
  currentTable,
  isProcessing,
  onClose,
  setIsProcessing,
}) => {
  const handlePublishWebflowItems = async () => {
    if (selectedRows.length === 0) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Get all selected record IDs
      const recordIds = selectedRows.map((record) => record.id.wsId);

      // Check if any selected records have remoteIds
      const recordsWithRemoteIds = selectedRows.filter((record) => record.id.remoteId);
      if (recordsWithRemoteIds.length === 0) {
        ScratchpadNotifications.error({
          title: 'Cannot Publish',
          message: 'Selected records must be synced with Webflow before they can be published.',
        });
        return;
      }

      const result = await customWebflowActionsApi.publishItems({
        snapshotTableId: currentTable.id,
        recordIds,
      });

      const publishedCount = result.publishedItemIds?.length || recordsWithRemoteIds.length;
      const itemText = publishedCount === 1 ? 'item' : 'items';

      ScratchpadNotifications.success({
        title: 'Items Published',
        message: `Successfully published ${publishedCount} ${itemText} to Webflow`,
      });

      // Show warning if some records were skipped
      if (recordsWithRemoteIds.length < selectedRows.length) {
        const skippedCount = selectedRows.length - recordsWithRemoteIds.length;
        ScratchpadNotifications.warning({
          title: 'Some Items Skipped',
          message: `${skippedCount} ${skippedCount === 1 ? 'record was' : 'records were'} skipped because they haven't been synced with Webflow yet.`,
        });
      }

      // Show errors if any
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((error) => {
          ScratchpadNotifications.error({
            title: 'Publish Error',
            message: error.message || 'Failed to publish item',
          });
        });
      }
    } catch (error) {
      console.error('Error publishing items:', error);
      ScratchpadNotifications.error({
        title: 'Error Publishing Items',
        message: error instanceof Error ? error.message : 'Failed to publish items to Webflow',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Menu.Item leftSection={<Upload size={14} />} onClick={handlePublishWebflowItems} disabled={isProcessing}>
      Publish live to Webflow
    </Menu.Item>
  );
};
