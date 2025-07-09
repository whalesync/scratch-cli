"use client";

import {
  Loader,
  Center,
  Stack,
  Title,
  Text,
  Group,
  SimpleGrid,
} from "@mantine/core";
import { useSnapshots } from "@/hooks/use-snapshot";
import { SnapshotCard } from "./SnapshotCard";

export const SnapshotsList = () => {
  const { snapshots, isLoading, error } = useSnapshots();

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

      <SimpleGrid cols={1} spacing="md" maw="600px">
        {snapshots && snapshots.length > 0 ? (
          snapshots.map((snapshot) => (
            <SnapshotCard key={snapshot.id} snapshot={snapshot} />
          ))
        ) : (
          <Text c="dimmed" style={{ textAlign: "center" }}>
            No snapshots found.
          </Text>
        )}
      </SimpleGrid>
    </Stack>
  );
}
