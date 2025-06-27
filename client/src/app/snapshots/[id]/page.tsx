"use client";

import { useSnapshot } from "@/hooks/use-snapshot";
import { snapshotApi } from "@/lib/api/snapshot";
import {
  ActionIcon,
  Button,
  Center,
  CheckIcon,
  CopyButton,
  Group,
  Loader,
  Stack,
  Tabs,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  DownloadSimpleIcon,
  HeadCircuitIcon,
  TableIcon,
  TrashIcon,
  UploadIcon,
  RobotIcon,
} from "@phosphor-icons/react";
import { useParams, useRouter } from "next/navigation";
import SnapshotTableGrid from "./SnapshotTableGrid";
import { TableSpec } from "@/types/server-entities/snapshot";
import AIChatPanel from "../../components/AIChatPanel";

import "@glideapps/glide-data-grid/dist/index.css";
import { useEffect, useState } from "react";
import { useConnectorAccount } from "../../../hooks/use-connector-account";

export default function SnapshotPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const { snapshot, isLoading, publish } = useSnapshot(id);
  const { connectorAccount } = useConnectorAccount(
    snapshot?.connectorAccountId
  );

  const [selectedTable, setSelectedTable] = useState<TableSpec | undefined>(
    undefined
  );
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    if (!selectedTable) {
      setSelectedTable(snapshot?.tables[0]);
    }
  }, [snapshot, selectedTable]);

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

  const handlePublish = async () => {
    try {
      notifications.show({
        id: "publish-notification", // So it gets replaced by below.
        title: "Publishing",
        message: `Your data is being published to ${connectorAccount?.service}`,
        color: "blue",
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });
      await publish();
      notifications.update({
        id: "publish-notification",
        title: "Published",
        message: `Your data has been published to ${connectorAccount?.service}`,
        color: "green",
        icon: <CheckIcon size={18} />,
        loading: false,
        autoClose: 2000,
      });
    } catch (e) {
      console.error(e);
      notifications.update({
        id: "publish-notification",
        title: "Publish failed",
        message:
          (e as Error).message ?? "There was an error publishing your data",
        color: "red",
        loading: false,
        autoClose: 2000,
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

  const toggleChat = () => {
    setShowChat(!showChat);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <Center flex={1}>
          <Loader />
        </Center>
      );
    }

    if (!snapshot) {
      return (
        <Center flex={1}>
          <Text>Snapshot not found.</Text>
        </Center>
      );
    }

    if (snapshot.tables.length === 0) {
      return (
        <Center flex={1}>
          <Stack align="center">
            <TableIcon size={400} color="#55ff55" />
            <Text size="md">No tables in this snapshot.</Text>
          </Stack>
        </Center>
      );
    }

    return (
      <Stack h="100%" gap={0}>
        <Tabs
          value={selectedTable?.id?.wsId}
          onChange={(value) =>
            setSelectedTable(snapshot.tables.find((t) => t.id.wsId === value))
          }
          variant="outline"
        >
          <Tabs.List px="sm">
            {snapshot.tables.map((table: TableSpec) => (
              <Tabs.Tab value={table.id.wsId} key={table.id.wsId}>
                {table.name}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
        {selectedTable && (
          <SnapshotTableGrid snapshotId={id} table={selectedTable} />
        )}
      </Stack>
    );
  };

  return (
    <Stack h="100vh">
      <Group p="xs" bg="gray.0">
        <Group>
          <Title order={2}>Editing snapshot</Title>
          <CopyButton value={`Connect to snapshot ${id}`} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip
                label={copied ? "Copied" : `Copy prompt for Cursor`}
                withArrow
                position="right"
              >
                <ActionIcon
                  color={copied ? "teal" : "gray"}
                  variant="subtle"
                  onClick={copy}
                >
                  {copied ? (
                    <CheckIcon size={16} />
                  ) : (
                    <HeadCircuitIcon size={16} />
                  )}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
        <Group ml="auto">
        <Button onClick={handleDownload} leftSection={<DownloadSimpleIcon />}>
            Download from remote
          </Button>
          <Button 
            onClick={toggleChat} 
            leftSection={<RobotIcon />}
            variant={showChat ? "filled" : "light"}
          >
            {showChat ? "Close AI" : "AI Analysis"}
          </Button>

          <Button
            variant="outline"
            onClick={handlePublish}
            leftSection={<UploadIcon />}
          >
            Publish
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
      
      <Group h="calc(100vh - 80px)" gap={0}>
        {/* Main content area */}
        <div style={{ 
          width: showChat ? "70%" : "100%", 
          height: "100%",
          transition: "width 0.3s ease"
        }}>
          {renderContent()}
        </div>
        
        {/* AI Chat Panel */}
        <AIChatPanel 
          isOpen={showChat} 
          onClose={() => setShowChat(false)}
          snapshotId={id}
        />
      </Group>
    </Stack>
  );
}
