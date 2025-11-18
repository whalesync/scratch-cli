import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotRecord, SnapshotTable } from '@/types/server-entities/workbook';
import { Upload } from 'lucide-react';
import React from 'react';
import { customWixActionsApi } from '../../../../../../../lib/api/custom-actions/wix';

interface WixPublishMenuItemProps {
  selectedRows: SnapshotRecord[];
  currentTable: SnapshotTable;
  isProcessing: boolean;
  onClose: () => void;
  setIsProcessing: (value: boolean) => void;
}

export const WixPublishMenuItem: React.FC<WixPublishMenuItemProps> = ({
  selectedRows,
  currentTable,
  isProcessing,
  onClose,
  setIsProcessing,
}) => {
  const handlePublishDraftPosts = async () => {
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
          message: 'Selected posts must be synced with Wix before they can be published.',
        });
        return;
      }

      const result = await customWixActionsApi.publishDraftPosts({
        snapshotTableId: currentTable.id,
        recordIds,
      });

      const publishedCount = result.publishedPostIds?.length || recordsWithRemoteIds.length;
      const postText = publishedCount === 1 ? 'post' : 'posts';

      ScratchpadNotifications.success({
        title: 'Posts Published',
        message: `Successfully published ${publishedCount} ${postText} to Wix Blog`,
      });

      // Show warning if some records were skipped
      if (recordsWithRemoteIds.length < selectedRows.length) {
        const skippedCount = selectedRows.length - recordsWithRemoteIds.length;
        ScratchpadNotifications.warning({
          title: 'Some Posts Skipped',
          message: `${skippedCount} ${skippedCount === 1 ? 'post was' : 'posts were'} skipped because they haven't been synced with Wix yet.`,
        });
      }

      // Show errors if any
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach((error) => {
          ScratchpadNotifications.error({
            title: 'Publish Error',
            message: error.message || 'Failed to publish post',
          });
        });
      }
    } catch (error) {
      console.error('Error publishing draft posts:', error);
      ScratchpadNotifications.error({
        title: 'Error Publishing Posts',
        message: error instanceof Error ? error.message : 'Failed to publish posts to Wix Blog',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      onClick={handlePublishDraftPosts}
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
        Publish to Wix Blog ({selectedRows.length} {selectedRows.length === 1 ? 'post' : 'posts'})
      </span>
    </div>
  );
};
