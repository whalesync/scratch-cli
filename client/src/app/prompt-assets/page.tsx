'use client';

import { PlusIcon } from 'lucide-react';
import { ButtonPrimarySolid } from '../components/base/buttons';
import { EditResourceModal, useEditResourceModal } from '../components/EditResourceModal';
import MainContent from '../components/layouts/MainContent';
import { PromptAssetTable } from './components/PromptAssetTable';

export default function PromptAssetsPage() {
  const resourceModal = useEditResourceModal();

  return (
    <MainContent>
      <MainContent.BasicHeader
        title="Prompt assets"
        actions={
          <ButtonPrimarySolid onClick={() => resourceModal.open('new')} leftSection={<PlusIcon />}>
            New asset
          </ButtonPrimarySolid>
        }
      />
      <MainContent.Body>
        <PromptAssetTable openEditModal={resourceModal.open} />
        <EditResourceModal {...resourceModal} />
      </MainContent.Body>
    </MainContent>
  );
}
