import { workbookApi } from '@/lib/api/workbook';
import { Badge, Button, Group, Modal, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { WorkbookId } from '@spinner/shared-types';
import { PlayIcon, PlusIcon, RefreshCwIcon, RocketIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface TestPublishV2ModalProps {
  opened: boolean;
  onClose: () => void;
  workbookId: WorkbookId;
  connectorAccountId?: string;
  connectorName?: string;
}

// Define interface locally for now as it matches server return
interface PublishPipeline {
  id: string;
  status: string;
  createdAt: string;
  connectorAccountId?: string;
  _count?: { entries: number };
}

export function TestPublishV2Modal({
  opened,
  onClose,
  workbookId,
  connectorAccountId,
  connectorName,
}: TestPublishV2ModalProps) {
  const [pipelines, setPipelines] = useState<PublishPipeline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlanning, setIsPlanning] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await workbookApi.listPublishV2Pipelines(workbookId, connectorAccountId);
      setPipelines(data);
    } catch (error) {
      console.error(error);
      notifications.show({
        title: 'Error',
        message: 'Failed to list pipelines',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workbookId, connectorAccountId]);

  useEffect(() => {
    if (opened) {
      fetchPipelines();
    }
  }, [opened, fetchPipelines]);

  const handlePlan = async () => {
    setIsPlanning(true);
    try {
      await workbookApi.planPublishV2(workbookId, connectorAccountId);
      notifications.show({
        title: 'Success',
        message: 'Publish pipeline planner started',
        color: 'green',
      });
      fetchPipelines();
    } catch (error) {
      console.error(error);
      notifications.show({
        title: 'Error',
        message: 'Failed to plan publish',
        color: 'red',
      });
    } finally {
      setIsPlanning(false);
    }
  };

  const handleRun = async (pipelineId: string) => {
    setRunningId(pipelineId);
    try {
      await workbookApi.runPublishV2(workbookId, pipelineId);
      notifications.show({
        title: 'Success',
        message: 'Publish pipeline execution started',
        color: 'green',
      });
      // Poll or just refresh? For now just refresh
      setTimeout(fetchPipelines, 1000);
    } catch (error) {
      console.error(error);
      notifications.show({
        title: 'Error',
        message: 'Failed to run publish',
        color: 'red',
      });
    } finally {
      setRunningId(null);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <RocketIcon size={20} />
          <Title order={4}>Test Publish V2 {connectorName ? `(${connectorName})` : ''}</Title>
        </Group>
      }
      size="xl"
    >
      <Stack>
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Manage publish pipelines (DB-backed V2)
          </Text>
          <Group>
            <Button
              variant="default"
              size="xs"
              leftSection={<RefreshCwIcon size={14} />}
              loading={isLoading}
              onClick={fetchPipelines}
            >
              Refresh
            </Button>
            <Button size="xs" leftSection={<PlusIcon size={14} />} loading={isPlanning} onClick={handlePlan}>
              Plan New Publish
            </Button>
          </Group>
        </Group>

        <ScrollArea h={400}>
          <Table stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>ID</Table.Th>
                <Table.Th>Created At</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Entries</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pipelines.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      No pipelines found. Click Plan New Publish to start one.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                pipelines.map((p) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>
                      <Text size="xs" ff="monospace">
                        {p.id.substring(0, 8)}...
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{new Date(p.createdAt).toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={
                          p.status === 'completed'
                            ? 'green'
                            : p.status === 'failed'
                              ? 'red'
                              : p.status === 'running'
                                ? 'blue'
                                : 'gray'
                        }
                        size="sm"
                      >
                        {p.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{p._count?.entries || 0}</Text>
                    </Table.Td>
                    <Table.Td>
                      {p.status !== 'completed' && p.status !== 'running' && (
                        <Button
                          size="xs"
                          variant="light"
                          color="green"
                          leftSection={<PlayIcon size={12} />}
                          loading={runningId === p.id}
                          onClick={() => handleRun(p.id)}
                          disabled={isPlanning || (runningId !== null && runningId !== p.id)}
                        >
                          Run
                        </Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Stack>
    </Modal>
  );
}
