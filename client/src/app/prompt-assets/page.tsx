'use client';

import { Menu } from '@mantine/core';
import { ChevronDownIcon, DownloadIcon, PenLineIcon, PlusIcon, UploadIcon } from 'lucide-react';
import { useRef } from 'react';
import { ButtonPrimarySolid, ButtonSecondaryOutline } from '../components/base/buttons';
import { PromptAssetDropzone } from '../components/dropzone/PromptAssetDropzone';
import MainContent from '../components/layouts/MainContent';
import { PromptAssetDetailModal, useEditAssetModal } from '../components/PromptAssetDetailModal';
import { PromptAssetTable } from './components/PromptAssetTable';

export default function PromptAssetsPage() {
  const resourceModal = useEditAssetModal();
  const openFileInputRef = useRef<() => void>(null);

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
      <MainContent.BasicHeader
        title="Prompt assets"
        actions={
          <>
            <ButtonSecondaryOutline leftSection={<UploadIcon size={14} />} onClick={() => openFileInputRef.current?.()}>
              Upload file
            </ButtonSecondaryOutline>
            {newAssetMenu}
          </>
        }
      />
      <MainContent.Body>
        <PromptAssetDropzone openRef={openFileInputRef}>
          <PromptAssetTable openEditModal={resourceModal.open} />
        </PromptAssetDropzone>
        <PromptAssetDetailModal {...resourceModal} />
      </MainContent.Body>
    </MainContent>
  );
}
