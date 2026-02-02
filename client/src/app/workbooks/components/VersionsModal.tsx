import { ModalWrapper } from '@/app/components/ModalWrapper';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { workbookApi } from '@/lib/api/workbook';
import { ActionIcon, Button, Group, Loader, Stack, Text, TextInput } from '@mantine/core';
import { WorkbookId } from '@spinner/shared-types';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { History, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

dayjs.extend(relativeTime);

interface VersionsModalProps {
  workbookId: WorkbookId;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Checkpoint {
  name: string;
  timestamp: number;
  message: string;
}

export const VersionsModal = ({ workbookId, isOpen, onClose, onSuccess }: VersionsModalProps) => {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newVersionName, setNewVersionName] = useState('');

  // validation state
  // const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchCheckpoints();
      setNewVersionName('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, workbookId]);

  const fetchCheckpoints = async () => {
    setLoading(true);
    try {
      const data = await workbookApi.listCheckpoints(workbookId);
      // Sort by timestamp desc
      setCheckpoints(data.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({ title: 'Error', message: 'Failed to load versions' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    // Validation
    // Prefix logic: The user wants "cp-my-message".
    // We can assume the input matches that or we prefix it.
    // "message of the checkpoint should be converted to cp-my-message"
    // "alphanumeric + dashesh and underscofres only"
    // "limit it to 30 characters"

    let cleanName = newVersionName
      .trim()
      .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace invalid chars with dash
      .replace(/-+/g, '-') // collapse dashes
      .toLowerCase();

    if (!cleanName.startsWith('cp-')) {
      cleanName = `cp-${cleanName}`;
    }

    // truncate to 30
    if (cleanName.length > 30) {
      cleanName = cleanName.substring(0, 30);
    }
    // remove trailing dash if truncated awkwardly
    if (cleanName.endsWith('-')) {
      cleanName = cleanName.slice(0, -1);
    }

    if (cleanName === 'cp' || cleanName === 'cp-') {
      ScratchpadNotifications.error({ title: 'Error', message: 'Name is too short' });
      return;
    }

    setCreating(true);
    try {
      await workbookApi.createCheckpoint(workbookId, cleanName);
      ScratchpadNotifications.success({ title: 'Success', message: 'Version created' });
      setNewVersionName('');
      fetchCheckpoints();
      onSuccess?.();
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({ title: 'Error', message: 'Failed to create version' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevert = async (name: string) => {
    if (
      !confirm(`Are you sure you want to revert to ${name}? This will overwrite current changes in the dirty branch.`)
    ) {
      return;
    }

    try {
      await workbookApi.revertToCheckpoint(workbookId, name);
      ScratchpadNotifications.success({ title: 'Success', message: `Reverted to ${name}` });
      onSuccess?.(); // Likely triggers a file refresh in parent
      onClose();
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({ title: 'Error', message: 'Failed to revert' });
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete version ${name}?`)) return;
    try {
      await workbookApi.deleteCheckpoint(workbookId, name);
      ScratchpadNotifications.success({ title: 'Success', message: 'Version deleted' });
      fetchCheckpoints();
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({ title: 'Error', message: 'Failed to delete' });
    }
  };

  return (
    <ModalWrapper
      title={
        <Group>
          <History size={20} />
          <Text>Versions (Checkpoints)</Text>
        </Group>
      }
      opened={isOpen}
      onClose={onClose}
      customProps={{ footer: null }}
    >
      <Stack p="md">
        <Group align="flex-end">
          <TextInput
            label="New Version Name"
            placeholder="e.g. my-feature"
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.currentTarget.value)}
            style={{ flex: 1 }}
            description="Auto-prefixed with 'cp-', max 30 chars"
          />
          <Button onClick={handleCreate} loading={creating} disabled={!newVersionName.trim()}>
            Create
          </Button>
        </Group>

        <Text fw={500} mt="sm">
          Existing Versions
        </Text>
        {loading ? (
          <Loader size="sm" />
        ) : checkpoints.length === 0 ? (
          <Text c="dimmed" size="sm">
            No versions saved.
          </Text>
        ) : (
          <Stack gap="xs">
            {checkpoints.map((cp) => (
              <Group
                key={cp.name}
                justify="space-between"
                p="xs"
                style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 4 }}
              >
                <div>
                  <Group gap={6}>
                    <Text fw={500} size="sm">
                      {cp.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {dayjs.unix(cp.timestamp).fromNow()}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {cp.message}
                  </Text>
                </div>
                <Group gap={4}>
                  <ActionIcon
                    color="blue"
                    variant="subtle"
                    title="Revert to this version"
                    onClick={() => handleRevert(cp.name)}
                  >
                    <RotateCcw size={16} />
                  </ActionIcon>
                  <ActionIcon color="red" variant="subtle" title="Delete version" onClick={() => handleDelete(cp.name)}>
                    <Trash2 size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            ))}
          </Stack>
        )}
      </Stack>
    </ModalWrapper>
  );
};
