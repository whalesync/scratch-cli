"use client";

import { useConnections } from "@/hooks/use-connections";
import { useState } from "react";
import { Service, Connection } from "@/types/server-entities/connections";
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
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { WarningCircle } from "@phosphor-icons/react";

export default function ConnectionsPage() {
  const {
    connections,
    isLoading,
    error,
    createConnection,
    deleteConnection,
    updateConnection,
  } = useConnections();

  // State for the creation form
  const [newApiKey, setNewApiKey] = useState("");
  const [newService, setNewService] = useState<Service | null>(null);

  // State for the update modal
  const [opened, { open, close }] = useDisclosure(false);
  const [selectedConnection, setSelectedConnection] =
    useState<Connection | null>(null);
  const [updatedName, setUpdatedName] = useState("");
  const [updatedApiKey, setUpdatedApiKey] = useState("");

  const handleCreate = async () => {
    if (!newService || !newApiKey) {
      alert("Service and API key are required.");
      return;
    }
    await createConnection({ service: newService, apiKey: newApiKey });
    setNewApiKey("");
    setNewService(null);
  };

  const handleOpenUpdateModal = (conn: Connection) => {
    setSelectedConnection(conn);
    setUpdatedName(conn.displayName);
    setUpdatedApiKey(conn.apiKey);
    open();
  };

  const handleUpdate = async () => {
    if (!selectedConnection) return;

    await updateConnection(selectedConnection.id, {
      displayName: updatedName,
      apiKey: updatedApiKey,
    });
    close();
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
        <Alert icon={<WarningCircle size="1rem" />} title="Error!" color="red">
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

          <Title order={2}>Existing Connections</Title>
          <Stack>
            {connections?.map((conn) => (
              <Paper withBorder shadow="sm" p="md" key={conn.id}>
                <Group justify="space-between">
                  <Text>
                    {conn.displayName} ({conn.service})
                  </Text>
                  <Group>
                    <Button
                      variant="outline"
                      onClick={() => handleOpenUpdateModal(conn)}
                    >
                      Update
                    </Button>
                    <Button
                      color="red"
                      onClick={() => deleteConnection(conn.id)}
                    >
                      Delete
                    </Button>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </Container>
    </>
  );
}
