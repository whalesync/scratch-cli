import { Snapshot } from "@/types/server-entities/snapshot";
import { RouteUrls } from "@/utils/route-urls";
import { Card, Group, Stack, Text } from "@mantine/core";
import { useRouter } from "next/navigation";
import styles from "./SnapshotCard.module.css";
import { ConnectorIcon } from "./ConnectorIcon";
import pluralize from "pluralize";

export const SnapshotCard = ({snapshot}: {snapshot:Snapshot }) => {
  const router = useRouter();

  return (
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
        <Text fz="sm">{snapshot.tables.length} {pluralize("table", snapshot.tables.length)}</Text>
        <Text fz="sm" c="dimmed">
          Created {new Date(snapshot.createdAt).toLocaleString()}
        </Text>
        </Stack>
      </Group>
    </Card>
  );
};