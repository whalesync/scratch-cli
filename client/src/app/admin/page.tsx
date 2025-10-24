'use client';

import { snapshotApi } from '@/lib/api/snapshot';
import { Alert, Badge, Button, Group, Paper, Stack, Table, Text } from '@mantine/core';
import { AlertCircle, Check, Wrench } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useScratchPadUser } from '../../hooks/useScratchpadUser';
import { FullPageLoader } from '../components/FullPageLoader';
import MainContent from '../components/layouts/MainContent';

interface OldStyleSnapshot {
  id: string;
  name: string | null;
  service: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  tableSpecsCount: number;
  snapshotTablesCount: number;
}

const AdminPage = () => {
  const { isAdmin, isLoading: isUserLoading } = useScratchPadUser();
  const [snapshots, setSnapshots] = useState<OldStyleSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixingSnapshots, setFixingSnapshots] = useState<Set<string>>(new Set());
  const [fixedSnapshots, setFixedSnapshots] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isUserLoading && isAdmin) {
      loadSnapshots();
    }
  }, [isUserLoading, isAdmin]);

  const loadSnapshots = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await snapshotApi.listOldStyleSnapshots();
      setSnapshots(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFixSnapshot = async (snapshotId: string) => {
    try {
      setFixingSnapshots((prev) => new Set(prev).add(snapshotId));
      setError(null);

      const result = await snapshotApi.fixSnapshot(snapshotId);

      if (result.success) {
        setFixedSnapshots((prev) => new Set(prev).add(snapshotId));
        // Remove from the list after a short delay to show the success state
        setTimeout(() => {
          setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
          setFixingSnapshots((prev) => {
            const next = new Set(prev);
            next.delete(snapshotId);
            return next;
          });
          setFixedSnapshots((prev) => {
            const next = new Set(prev);
            next.delete(snapshotId);
            return next;
          });
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fix snapshot');
      setFixingSnapshots((prev) => {
        const next = new Set(prev);
        next.delete(snapshotId);
        return next;
      });
    }
  };

  if (isUserLoading) {
    return <FullPageLoader />;
  }

  if (!isAdmin) {
    return (
      <MainContent>
        <MainContent.BasicHeader title="Access Denied" />
        <MainContent.Body>
          <Alert icon={<AlertCircle size={16} />} title="Access Denied" color="red">
            You do not have permission to access this page.
          </Alert>
        </MainContent.Body>
      </MainContent>
    );
  }

  return (
    <MainContent>
      <MainContent.BasicHeader title="Admin - Old Style Snapshots" />
      <MainContent.Body>
        <Stack gap="md">
          <Paper p="md" withBorder>
            <Text size="sm" c="dimmed">
              This page lists all snapshots that have data in the deprecated <code>tableSpecs</code> field but no
              related <code>SnapshotTable</code> records. Click the fix button next to each snapshot to migrate it to
              the new format.
            </Text>
          </Paper>

          {error && (
            <Alert icon={<AlertCircle size={16} />} title="Error" color="red" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {isLoading ? (
            <FullPageLoader />
          ) : snapshots.length === 0 ? (
            <Alert icon={<Check size={16} />} title="All Clear" color="green">
              No old-style snapshots found. All snapshots have been migrated!
            </Alert>
          ) : (
            <Paper withBorder>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Snapshot ID</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Service</Table.Th>
                    <Table.Th>User ID</Table.Th>
                    <Table.Th>Tables</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>Action</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {snapshots.map((snapshot) => {
                    const isFixing = fixingSnapshots.has(snapshot.id);
                    const isFixed = fixedSnapshots.has(snapshot.id);

                    return (
                      <Table.Tr key={snapshot.id}>
                        <Table.Td>
                          <Text size="xs" ff="monospace">
                            {snapshot.id}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{snapshot.name || <em>Unnamed</em>}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light">
                            {snapshot.service}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" ff="monospace">
                            {snapshot.userId}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{snapshot.tableSpecsCount}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs">{new Date(snapshot.createdAt).toLocaleDateString()}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant={isFixed ? 'light' : 'filled'}
                              color={isFixed ? 'green' : 'blue'}
                              leftSection={isFixed ? <Check size={14} /> : <Wrench size={14} />}
                              onClick={() => handleFixSnapshot(snapshot.id)}
                              loading={isFixing}
                              disabled={isFixed}
                            >
                              {isFixed ? 'Fixed' : 'Fix'}
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          <Paper p="md" withBorder>
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                Total Old-Style Snapshots: {snapshots.length}
              </Text>
              <Button onClick={loadSnapshots} variant="subtle" size="sm">
                Refresh
              </Button>
            </Group>
          </Paper>
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default AdminPage;
