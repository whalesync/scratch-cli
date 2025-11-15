import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotRecord, SnapshotTable } from '@/types/server-entities/snapshot';
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
    <div
      onClick={handlePublishWebflowItems}
      style={{
        padding: '8px 12px',
        cursor: isProcessing ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        opacity: isProcessing ? 0.5 : 1,
        backgroundColor: 'transparent',
        transition: 'background-color 0.1s',
      }}
      onMouseEnter={(e) => {
        if (!isProcessing) {
          e.currentTarget.style.backgroundColor = '#3a3a3a';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <StyledLucideIcon Icon={Upload} size={16} c="#00aa00" />
      <span>
        Publish Live to Webflow ({selectedRows.length} {selectedRows.length === 1 ? 'item' : 'items'})
      </span>
    </div>
  );
};
