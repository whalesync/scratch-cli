"use client";

import { useSnapshots } from "@/hooks/use-snapshot";
import { connectorAccountsApi } from "@/lib/api/connector-accounts";
import {
  ConnectorAccount,
  ConnectorHealthStatus,
} from "@/types/server-entities/connector-accounts";
import { TablePreview } from "@/types/server-entities/table-list";
import {
  Badge,
  Button,
  Checkbox,
  Divider,
  Group,
  Loader,
  Modal,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircleIcon,
  QuestionIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { RouteUrls } from "@/utils/route-urls";

interface ConnectorAccountRowProps {
  connectorAccount: ConnectorAccount;
  onTest: (id: string) => void;
  onUpdate: (conn: ConnectorAccount) => void;
  onDelete: (id: string) => void;
  testingId: string | null;
}

export function ConnectorAccountRow({
  connectorAccount,
  onTest,
  onUpdate,
  onDelete,
  testingId,
}: ConnectorAccountRowProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [tables, setTables] = useState<TablePreview[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const {
    snapshots,
    createSnapshot,
    isLoading: isLoadingSnapshots,
  } = useSnapshots(connectorAccount.id);

  useEffect(() => {
    if (opened) {
      setIsLoadingTables(true);
      setError(null);
      connectorAccountsApi
        .listTables(connectorAccount.id)
        .then((data) => setTables(data.tables))
        .catch((e) => setError(e.message ?? "An unknown error occurred"))
        .finally(() => setIsLoadingTables(false));
    } else {
      // Clear state when modal is closed
      setTables([]);
      setSelectedTables([]);
      setError(null);
    }
  }, [opened, connectorAccount.id]);

  const handleCreateSession = () => {
    // We are storing the wsId in selectedTables. Find the full EntityId
    const tableIds = tables
      .filter((t) => selectedTables.includes(t.id.wsId))
      .map((t) => t.id);

    createSnapshot({
      connectorAccountId: connectorAccount.id,
      tableIds: tableIds,
    });
    close();
  };

  const handleWorkWithSnapshot = (id: string) => {
    router.push(RouteUrls.snapshotPage(id));
  };

  const HealthIcon = (c: ConnectorAccount) => {
    let text = "";
    let color = "gray";
    let icon = <></>;
    if (!c.healthStatus || !c.healthStatusLastCheckedAt) {
      text = "Connection status unknown";
      color = "gray";
      icon = <QuestionIcon />;
    }

    if (c.healthStatus === ConnectorHealthStatus.OK) {
      text = `Connection OK`;
      color = "green";
      icon = <CheckCircleIcon />;
    }

    if (c.healthStatus === ConnectorHealthStatus.FAILED) {
      text = `Connection problem`;
      color = "red";
      icon = <XCircleIcon />;
    }

    return (
      <Group c={color} gap="xs">
        {icon}
        <Text size="sm">{text}</Text>
      </Group>
    );
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={close}
        title="Start new snapshot"
        size="xl"
        centered
      >
        {isLoadingTables ? (
          <Group justify="center">
            <Loader />
            <Text>Loading tables...</Text>
          </Group>
        ) : error ? (
          <Text c="red">{error}</Text>
        ) : (
          <>
            <Checkbox.Group
              value={selectedTables}
              onChange={setSelectedTables}
              label="Select tables to include in the snapshot"
            >
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() =>
                    setSelectedTables(tables.map((t) => t.id.wsId))
                  }
                >
                  Select all
                </Button>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => setSelectedTables([])}
                >
                  Select none
                </Button>
              </Group>

              <Paper withBorder p="md" mt="sm">
                <ScrollArea h={400}>
                  <Stack mt="xs">
                    {tables
                      .sort((a, b) =>
                        a.displayName.localeCompare(b.displayName)
                      )
                      .map((table) => (
                        <Checkbox
                          key={`${table.id.wsId}-${table.displayName}`}
                          value={table.id.wsId}
                          label={table.displayName}
                        />
                      ))}
                  </Stack>
                </ScrollArea>
              </Paper>
            </Checkbox.Group>
          </>
        )}
        <Group justify="flex-end" mt="xl">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateSession}
            disabled={selectedTables.length === 0 || !!error}
          >
            Create snapshot
          </Button>
        </Group>
      </Modal>
      <Paper withBorder shadow="sm" p="md" key={connectorAccount.id}>
        <Stack>
          <Group>
            <Badge variant="outline" color="yellow" radius="xs">
              {connectorAccount.service}
            </Badge>
            <Title order={3}>{connectorAccount.displayName}</Title>
            <Button
              variant="outline"
              onClick={() => onUpdate(connectorAccount)}
              ml="auto"
            >
              Edit
            </Button>

            <Button color="red" onClick={() => onDelete(connectorAccount.id)}>
              Delete
            </Button>
          </Group>
          <Divider />
          <Group gap="xs">
            <HealthIcon {...connectorAccount} />
            <Button
              variant="subtle"
              onClick={() => onTest(connectorAccount.id)}
              loading={testingId === connectorAccount.id}
              size="xs"
            >
              Test
            </Button>
          </Group>
          <Group justify="flex-end">
            {isLoadingSnapshots ? (
              <Loader size="sm" />
            ) : (
              <Stack align="flex-end">
                {snapshots?.map((snapshot) => (
                  <Button
                    key={snapshot.id}
                    onClick={() => handleWorkWithSnapshot(snapshot.id)}
                    variant="outline"
                  >
                    View & edit snapshot data
                  </Button>
                ))}
                {(snapshots?.length ?? 0) === 0 && (
                  <Button onClick={open}>Start new snapshot</Button>
                )}
              </Stack>
            )}
          </Group>
        </Stack>
      </Paper>
    </>
  );
}
