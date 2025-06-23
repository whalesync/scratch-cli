"use client";

import { snapshotApi } from "@/lib/api/snapshot";
import { Button, Group, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Table as TableIcon } from "@phosphor-icons/react";
import { useParams } from "next/navigation";

export default function SnapshotPage() {
  const params = useParams();
  const id = params.id as string;

  const handleDownload = async () => {
    try {
      await snapshotApi.download(id);
      notifications.show({
        title: "Download started",
        message: "Your data is being downloaded from the remote source.",
        color: "blue",
      });
    } catch (e) {
      console.error(e);
      notifications.show({
        title: "Download failed",
        message: "There was an error starting the download.",
        color: "red",
      });
    }
  };

  return (
    <Stack h="100%">
      <Group justify="space-between">
        <Text>Snapshot: {id}</Text>
        <Group>
          <Button variant="outline" onClick={handleDownload}>
            Download from remote
          </Button>
          <Button>Save to remote</Button>
        </Group>
      </Group>
      <Stack
        align="center"
        justify="center"
        h="100%"
        bg="gray.1"
        style={{ borderRadius: "var(--mantine-radius-md)" }}
      >
        <TableIcon size={64} />
        <Text size="xl">TODO: spreadsheet view</Text>
      </Stack>
    </Stack>
  );
}
