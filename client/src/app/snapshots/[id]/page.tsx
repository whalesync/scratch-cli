"use client";

import { snapshotApi } from "@/lib/api/snapshot";
import { Button, Center, Group, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  DownloadSimpleIcon,
  TableIcon,
  TrashIcon,
  UploadIcon,
} from "@phosphor-icons/react";
import { useParams, useRouter } from "next/navigation";

export default function SnapshotPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

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

  const handleAbandon = async () => {
    try {
      await snapshotApi.delete(id);
      notifications.show({
        title: "Snapshot abandoned",
        message: "The snapshot and its data have been deleted.",
        color: "green",
      });
      router.back();
    } catch (e) {
      console.error(e);
      notifications.show({
        title: "Deletion failed",
        message: "There was an error deleting the snapshot.",
        color: "red",
      });
    }
  };

  return (
    <Stack h="100vh">
      <Group p="xs" bg="gray.0">
        <Title order={2}>Snapshot: {id}</Title>
        <Group ml="auto">
          <Button onClick={handleDownload} leftSection={<DownloadSimpleIcon />}>
            Download from remote
          </Button>
          <Button
            variant="outline"
            onClick={() => alert("NOT YET IMPLEMENTED")}
            leftSection={<UploadIcon />}
          >
            Save to remote
          </Button>
          <Button
            variant="outline"
            color="red"
            onClick={handleAbandon}
            leftSection={<TrashIcon />}
          >
            Abandon snapshot
          </Button>
        </Group>
      </Group>
      <Center flex={1}>
        <Stack align="center">
          <TableIcon size={400} color="#55ff55" />
          <Text size="md">TODO: spreadsheet view</Text>
        </Stack>
      </Center>
    </Stack>
  );
}
