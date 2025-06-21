"use client";

import { useState } from "react";
import {
  Service,
  ConnectorAccount,
  ConnectorHealthStatus,
} from "@/types/server-entities/connector-accounts";
import {
  Container,
  Title,
  Stack,
  Loader,
  Alert,
  Paper,
  Group,
  Button,
  Select,
  TextInput,
  Text,
  Modal,
  Badge,
  Tooltip,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  WarningCircleIcon,
  XCircleIcon,
  CheckCircleIcon,
  QuestionIcon,
} from "@phosphor-icons/react";
import { useConnectorAccounts } from "../../hooks/use-connector-account";

export default function ConnectorAccountsPage() {
  const {
    isLoading,
    error,
    connectorAccounts,
    createConnectorAccount,
    deleteConnectorAccount,
    updateConnectorAccount,
    testConnection,
  } = useConnectorAccounts();

  // State for the creation form
  const [newApiKey, setNewApiKey] = useState("");
  const [newService, setNewService] = useState<Service | null>(null);

  // State for the update modal
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedConnectorAccount, setSelectedConnectorAccount] =
    useState<ConnectorAccount | null>(null);
  const [updatedName, setUpdatedName] = useState("");
  const [updatedApiKey, setUpdatedApiKey] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newService || !newApiKey) {
      alert("Service and API key are required.");
      return;
    }
    await createConnectorAccount({ service: newService, apiKey: newApiKey });
    setNewApiKey("");
    setNewService(null);
  };

  const handleOpenUpdateModal = (conn: ConnectorAccount) => {
    setSelectedConnectorAccount(conn);
    setUpdatedName(conn.displayName);
    setUpdatedApiKey(conn.apiKey);
    open();
  };

  const handleUpdate = async () => {
    if (!selectedConnectorAccount) return;

    await updateConnectorAccount(selectedConnectorAccount.id, {
      displayName: updatedName,
      apiKey: updatedApiKey,
    });
    close();
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    const r = await testConnection(id);
    if (r.health === "error") {
      notifications.show({
        title: "Connection Test Failed",
        message: r.error,
        color: "red",
      });
    } else {
      notifications.show({
        title: "Connection Test Succeeded",
        message: "Successfully connected to the service.",
        color: "green",
      });
    }
    setTestingId(null);
  };

  const HealthIcon = (c: ConnectorAccount) => {
    const size = 36;
    if (!c.healthStatus || !c.healthStatusLastCheckedAt) {
      return (
        <Tooltip label="Connection status unknown" withArrow>
          <QuestionIcon size={size} />
        </Tooltip>
      );
    }

    if (c.healthStatus === ConnectorHealthStatus.OK) {
      return (
        <Tooltip
          label={`Connection tested successfully at ${new Date(
            c.healthStatusLastCheckedAt
          ).toLocaleString()}`}
          withArrow
        >
          <CheckCircleIcon size={size} color="green" />
        </Tooltip>
      );
    }

    if (c.healthStatus === ConnectorHealthStatus.FAILED) {
      return (
        <Tooltip
          label={`Connection test failed at ${new Date(
            c.healthStatusLastCheckedAt
          ).toLocaleString()}`}
          withArrow
        >
          <XCircleIcon size={size} color="red" />
        </Tooltip>
      );
    }

    return (
      <Tooltip label="Connection status unknown" withArrow>
        <QuestionIcon size={size} />
      </Tooltip>
    );
  };

  if (isLoading) {
    return (
      <Container>
        <Loader />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Alert
          icon={<WarningCircleIcon size="1rem" />}
          title="Error!"
          color="red"
        >
          Failed to load connections. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <Modal opened={opened} onClose={close} title="Update Connection">
        <Stack>
          <TextInput
            label="Display Name"
            value={updatedName}
            onChange={(e) => setUpdatedName(e.currentTarget.value)}
          />
          <TextInput
            label="API Key"
            value={updatedApiKey}
            onChange={(e) => setUpdatedApiKey(e.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Save</Button>
          </Group>
        </Stack>
      </Modal>

      <Container>
        <Stack>
          <Title order={1}>Connection Management</Title>

          {connectorAccounts && connectorAccounts.length > 0 && (
            <>
              <Title order={2}>Existing Connections</Title>
              <Stack>
                {connectorAccounts?.map((conn) => (
                  <Paper withBorder shadow="sm" p="md" key={conn.id}>
                    <Group justify="space-between">
                      <Group>
                        <Badge variant="outline" color="yellow" radius="xs">
                          {conn.service}
                        </Badge>
                        <Text>{conn.displayName}</Text>
                      </Group>
                      <Group>
                        <HealthIcon {...conn} />
                        <Button
                          variant="outline"
                          onClick={() => handleTest(conn.id)}
                          loading={testingId === conn.id}
                        >
                          Test connection
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleOpenUpdateModal(conn)}
                        >
                          Edit
                        </Button>
                        <Button
                          color="red"
                          onClick={() => deleteConnectorAccount(conn.id)}
                        >
                          Delete
                        </Button>
                      </Group>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            </>
          )}

          <Paper withBorder shadow="md" p="md">
            <Stack>
              <Title order={2}>Create New Connection</Title>
              <Select
                label="Service"
                placeholder="Pick a service"
                data={Object.values(Service)}
                value={newService}
                onChange={(value) => setNewService(value as Service)}
              />
              <TextInput
                label="API Key"
                placeholder="Enter API Key"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.currentTarget.value)}
              />
              <Button onClick={handleCreate}>Create</Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </>
  );
}
