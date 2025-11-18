import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { SnapshotTable } from '@/types/server-entities/workbook';
import { Loader, Menu } from '@mantine/core';
import { Globe } from 'lucide-react';
import React from 'react';
import { customWebflowActionsApi } from '../../../../../../../lib/api/custom-actions/webflow';

interface WebflowPublishSiteMenuItemProps {
  currentTable: SnapshotTable;
  disabled?: boolean;
  onPublishStart: () => void;
  onPublishEnd: () => void;
}

export const WebflowPublishSiteMenuItem: React.FC<WebflowPublishSiteMenuItemProps> = ({
  currentTable,
  disabled,
  onPublishStart,
  onPublishEnd,
}) => {
  const [isPublishing, setIsPublishing] = React.useState(false);

  const handlePublishSite = async () => {
    try {
      setIsPublishing(true);
      onPublishStart();

      const result = await customWebflowActionsApi.publishSite({
        snapshotTableId: currentTable.id,
      });

      ScratchpadNotifications.success({
        title: 'Site Published',
        message: result.queued
          ? 'Your Webflow site has been queued for publishing'
          : 'Your Webflow site has been published successfully',
      });
    } catch (error) {
      console.error('Error publishing site:', error);
      ScratchpadNotifications.error({
        title: 'Error Publishing Site',
        message: error instanceof Error ? error.message : 'Failed to publish site to Webflow',
      });
    } finally {
      setIsPublishing(false);
      onPublishEnd();
    }
  };

  return (
    <Menu.Item
      disabled={disabled || isPublishing}
      onClick={handlePublishSite}
      leftSection={isPublishing ? <Loader size="xs" /> : <Globe size={16} />}
    >
      Publish Live to Webflow
    </Menu.Item>
  );
};
