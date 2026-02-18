import { workbookApi } from '@/lib/api/workbook';
import { Badge, Button, Group, Menu, Modal, ScrollArea, Stack, Table, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { WorkbookId } from '@spinner/shared-types';
import { ChevronDownIcon, ListIcon, PlayIcon, PlusIcon, RefreshCwIcon, RocketIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PlanEntriesModal } from './PlanEntriesModal';

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

const PHASES = ['edit', 'create', 'delete', 'backfill'] as const;

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
  const [entriesModalPipelineId, setEntriesModalPipelineId] = useState<string | null>(null);

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

  const handleRun = async (pipelineId: string, phase?: string) => {
    setRunningId(pipelineId);
    try {
      await workbookApi.runPublishV2(workbookId, pipelineId, phase);
      notifications.show({
        title: 'Success',
        message: phase ? `Running ${phase} phase` : 'Running all phases',
        color: 'green',
      });
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
    <>
      <Modal
        opened={opened}
        onClose={onClose}
        closeOnEscape={!entriesModalPipelineId}
        title={
          <Group gap="xs">
            <RocketIcon size={20} />
            <Title order={4}>Test Publish V2 {connectorName ? `(${connectorName})` : ''}</Title>
          </Group>
        }
        size="90%"
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
                                : p.status.endsWith('-running')
                                  ? 'blue'
                                  : p.status.endsWith('-completed')
                                    ? 'teal'
                                    : p.status === 'planned'
                                      ? 'yellow'
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
                        <Group gap="xs">
                          <Button
                            size="xs"
                            variant="light"
                            leftSection={<ListIcon size={12} />}
                            onClick={() => setEntriesModalPipelineId(p.id)}
                          >
                            View Entries
                          </Button>
                          {p.status !== 'completed' && !p.status.endsWith('-running') && (
                            <Group gap={0}>
                              <Button
                                size="xs"
                                variant="light"
                                color="green"
                                leftSection={<PlayIcon size={12} />}
                                loading={runningId === p.id}
                                onClick={() => handleRun(p.id)}
                                disabled={isPlanning || (runningId !== null && runningId !== p.id)}
                                style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                              >
                                Run All
                              </Button>
                              <Menu position="bottom-end" withinPortal>
                                <Menu.Target>
                                  <Button
                                    size="xs"
                                    variant="light"
                                    color="green"
                                    px={6}
                                    disabled={isPlanning || (runningId !== null && runningId !== p.id)}
                                    style={{
                                      borderTopLeftRadius: 0,
                                      borderBottomLeftRadius: 0,
                                      borderLeft: '1px solid var(--mantine-color-green-light-hover)',
                                    }}
                                  >
                                    <ChevronDownIcon size={12} />
                                  </Button>
                                </Menu.Target>
                                <Menu.Dropdown>
                                  <Menu.Label>Run single phase</Menu.Label>
                                  {PHASES.map((phase) => (
                                    <Menu.Item
                                      key={phase}
                                      onClick={() => handleRun(p.id, phase)}
                                      leftSection={<PlayIcon size={12} />}
                                    >
                                      {phase.charAt(0).toUpperCase() + phase.slice(1)}
                                    </Menu.Item>
                                  ))}
                                </Menu.Dropdown>
                              </Menu>
                            </Group>
                          )}
                          <Button
                            size="xs"
                            variant="subtle"
                            color="red"
                            leftSection={<Trash2Icon size={12} />}
                            onClick={async () => {
                              if (confirm('Are you sure you want to delete this pipeline?')) {
                                await workbookApi.deletePublishV2Pipeline(workbookId, p.id);
                                fetchPipelines();
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Stack>
      </Modal>

      {entriesModalPipelineId && (
        <PlanEntriesModal
          opened={!!entriesModalPipelineId}
          onClose={() => setEntriesModalPipelineId(null)}
          workbookId={workbookId}
          pipelineId={entriesModalPipelineId}
        />
      )}
    </>
  );
}
