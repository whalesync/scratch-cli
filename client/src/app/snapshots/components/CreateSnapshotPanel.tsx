'use client';

import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { useContentTools } from '@/hooks/use-content-tools';
import { sleep } from '@/utils/helpers';
import { RouteUrls } from '@/utils/route-urls';
import { Alert, Group, Modal, Stack, TextInput, useModalsStack } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ScratchpadNotifications } from '../../components/ScratchpadNotifications';

export const CreateSnapshotPanel = () => {
  const { createContentSnapshot } = useContentTools();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();
  const modalStack = useModalsStack(['create-content-snapshot']);
  const [contentName, setContentName] = useState('');

  const handleCreateContentSnapshot = async () => {
    if (!contentName) {
      setSaveError('Content name is required');
      return;
    }

    setIsSaving(true);
    try {
      const snapshot = await createContentSnapshot(contentName);

      ScratchpadNotifications.success({
        title: 'Content snapshot created',
        message: 'The content snapshot has been created',
      });

      await sleep(200);
      modalStack.close('create-content-snapshot');
      router.push(RouteUrls.snapshotPage(snapshot.id));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Modal title="Create content snapshot" centered size="md" {...modalStack.register('create-content-snapshot')}>
        <Stack>
          {saveError && (
            <Alert color="red" title="Error creating content snapshot">
              {saveError}
            </Alert>
          )}
          <TextInput
            label="Content Name"
            description="Defines the name of the CSV file and related snapshot table"
            required
            value={contentName}
            onChange={(e) => setContentName(e.target.value)}
          />
          <Group justify="flex-end">
            <SecondaryButton
              onClick={() => {
                setContentName('');
                setSaveError(null);
                modalStack.close('create-content-snapshot');
              }}
            >
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handleCreateContentSnapshot} loading={isSaving} disabled={!contentName}>
              Create
            </PrimaryButton>
          </Group>
        </Stack>
      </Modal>
      <Stack>
        <PrimaryButton w="min-content" onClick={() => modalStack.open('create-content-snapshot')} loading={isSaving}>
          New content snapshot
        </PrimaryButton>
      </Stack>
    </>
  );
};
