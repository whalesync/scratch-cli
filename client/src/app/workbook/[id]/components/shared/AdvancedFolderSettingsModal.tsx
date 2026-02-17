'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { ModalWrapper } from '@/app/components/ModalWrapper';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { dataFolderApi } from '@/lib/api/data-folder';
import { Stack, Textarea } from '@mantine/core';
import type { DataFolder } from '@spinner/shared-types';
import { Service } from '@spinner/shared-types';
import { useEffect, useState } from 'react';

interface AdvancedFolderSettingsModalProps {
  opened: boolean;
  onClose: () => void;
  folder: DataFolder;
}

const FILTER_SUPPORTED_SERVICES = new Set([Service.NOTION, Service.AIRTABLE]);

export function AdvancedFolderSettingsModal({ opened, onClose, folder }: AdvancedFolderSettingsModalProps) {
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const supportsFilter = folder.connectorService != null && FILTER_SUPPORTED_SERVICES.has(folder.connectorService);

  useEffect(() => {
    if (opened) {
      setFilter(folder.filter ?? '');
    }
  }, [opened, folder.filter]);

  const handleSave = async () => {
    setLoading(true);
    try {
      await dataFolderApi.update(folder.id, { filter: filter.trim() || null });
      ScratchpadNotifications.success({
        title: 'Settings Updated',
        message: `Updated settings for ${folder.name}`,
      });
      onClose();
    } catch (error) {
      console.error('Failed to update folder settings', error);
      ScratchpadNotifications.error({
        title: 'Update Failed',
        message: 'Could not update folder settings.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper
      title="Advanced Settings"
      opened={opened}
      onClose={onClose}
      customProps={{
        footer: (
          <>
            <ButtonSecondaryOutline onClick={onClose}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleSave} loading={loading} disabled={!supportsFilter}>
              Save
            </ButtonPrimaryLight>
          </>
        ),
      }}
    >
      <Stack>
        <Textarea
          label="Filter"
          description={
            supportsFilter
              ? 'Filter expression applied when pulling records from this table.'
              : 'Filters are only supported for Notion and Airtable connectors.'
          }
          placeholder={supportsFilter ? 'Enter filter expression...' : ''}
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          disabled={!supportsFilter}
          autosize
          minRows={3}
          maxRows={6}
        />
      </Stack>
    </ModalWrapper>
  );
}
