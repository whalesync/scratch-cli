"use client";

import {
  Loader,
  Center,
  Stack,
  Title,
  Text,
  Group,
  SimpleGrid,
  Card,
} from "@mantine/core";
import { RouteUrls } from "@/utils/route-urls";
import { useSnapshots } from "@/hooks/use-snapshot";
import { useRouter } from "next/navigation";
import { ConnectorIcon } from "../components/ConnectorIcon";
import styles from "./page.module.css";

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

      <SimpleGrid cols={1} spacing="md" maw="600px">
        {snapshots && snapshots.length > 0 ? (
          snapshots.map((snapshot) => (
            <Card
              shadow="sm"
              p="xs"
              radius="md"
              withBorder
              key={snapshot.id}
              onClick={() => router.push(RouteUrls.snapshotPage(snapshot.id))}
              className={styles.snapshotCard}
              mah="500px"
            >
              <Group justify="flex-start" align="flex-start">
                <ConnectorIcon connector={snapshot.connectorService} />
                <Stack gap="4px">
                  <Text>{snapshot.name}</Text>
                  <Text>{snapshot.tables.length} table(s)</Text>
                  <Text fz="sm" c="dimmed">
                    Created {new Date(snapshot.createdAt).toLocaleString()}
                  </Text>
                </Stack>
              </Group>
            </Card>
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
