"use client";

import {
  Table,
  Loader,
  Center,
  Stack,
  Title,
  Text,
  Group,
} from "@mantine/core";
import { RouteUrls } from "@/utils/route-urls";
import { useSnapshots } from "@/hooks/use-snapshot";
import { useRouter } from "next/navigation";

export default function SnapshotsListPage() {
  const { snapshots, isLoading, error } = useSnapshots();
  const router = useRouter();

  if (isLoading) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h="100%">
        <Text c="red">{error}</Text>
      </Center>
    );
  }

  return (
    <Stack p="lg" h="100%">
      <Group justify="space-between">
        <Title order={2}>Snapshots</Title>
      </Group>
      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>Created At</Table.Th>
            <Table.Th>Updated At</Table.Th>
            <Table.Th>Connector Account</Table.Th>
            <Table.Th># Tables</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {snapshots && snapshots.length > 0 ? (
            snapshots.map((snapshot) => (
              <Table.Tr
                key={snapshot.id}
                onClick={() => {
                  router.push(RouteUrls.snapshotPage(snapshot.id));
                }}
                style={{ cursor: "pointer" }}
              >
                <Table.Td>{snapshot.id}</Table.Td>
                <Table.Td>
                  {new Date(snapshot.createdAt).toLocaleString()}
                </Table.Td>
                <Table.Td>
                  {new Date(snapshot.updatedAt).toLocaleString()}
                </Table.Td>
                <Table.Td>{snapshot.connectorService}</Table.Td>
                <Table.Td>{snapshot.tables.length}</Table.Td>
              </Table.Tr>
            ))
          ) : (
            <Table.Tr>
              <Table.Td colSpan={6}>
                <Text c="dimmed" style={{ textAlign: "center" }}>
                  No snapshots found.
                </Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
