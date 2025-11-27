'use client';

import { Menu } from '@mantine/core';
import { ChevronDownIcon, DownloadIcon, PenLineIcon, PlusIcon } from 'lucide-react';
import { ButtonPrimarySolid } from '../components/base/buttons';
import MainContent from '../components/layouts/MainContent';
import { PromptAssetDetailModal, useEditAssetModal } from '../components/PromptAssetDetailModal';
import { PromptAssetTable } from './components/PromptAssetTable';

export default function PromptAssetsPage() {
  const resourceModal = useEditAssetModal();

  const newAssetMenu = (
    <Menu>
      <Menu.Target>
        <ButtonPrimarySolid leftSection={<PlusIcon size={14} />} rightSection={<ChevronDownIcon size={14} />}>
          New asset
        </ButtonPrimarySolid>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<PenLineIcon size={14} />} onClick={() => resourceModal.open('new-text')}>
          New blank asset
        </Menu.Item>
        <Menu.Item leftSection={<DownloadIcon size={14} />} onClick={() => resourceModal.open('new-url')}>
          Import from URL
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );

  return (
    <MainContent>
      <MainContent.BasicHeader title="Prompt assets" actions={newAssetMenu} />
      <MainContent.Body>
        <PromptAssetTable openEditModal={resourceModal.open} />
        <PromptAssetDetailModal {...resourceModal} />
      </MainContent.Body>
    </MainContent>
  );
}
