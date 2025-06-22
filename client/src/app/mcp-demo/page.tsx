"use client";

import { useState, useEffect } from "react";
import { Container, Title, Text, Button, Group } from "@mantine/core";
import { io } from "socket.io-client";
import dynamic from "next/dynamic";
import { API_CONFIG } from "@/lib/api/config";

interface Record {
  id: string;
  remote: { title: string };
  staged: { title: string } | null | undefined;
  suggested: { title: string } | null | undefined;
}

// This is a workaround to avoid the server-side rendering of the RecordsGrid component and allow Next.js to prerender the page
const RecordsGridWithNoSSR = dynamic(
  () => import("../components/RecordsGrid"),
  {
    ssr: false,
  }
);

// Create socket instance
const socket = io(API_CONFIG.getApiUrl(), {
  transports: ["websocket"],
});

export default function Home() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const fetchRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_CONFIG.getApiUrl()}/records`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const updateRecord = async (id: string, title: string) => {
    try {
      const response = await fetch(`${API_CONFIG.getApiUrl()}/records/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stage: true, data: { title } }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // The server will emit the update event, which will trigger a refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const response = await fetch(`${API_CONFIG.getApiUrl()}/records/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ stage: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // The server will emit the update event, which will trigger a refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const pushChanges = async () => {
    try {
      const response = await fetch(`${API_CONFIG.getApiUrl()}/records/push`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // The server will emit the update event, which will trigger a refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchRecords();

    // Set up WebSocket listeners
    socket.on("connect", () => {
      console.log("Connected to WebSocket server");
    });

    socket.on("recordsUpdated", () => {
      console.log("Records updated, refreshing...");
      fetchRecords();
    });

    socket.on("error", (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error");
    });

    // Cleanup function
    return () => {
      socket.off("connect");
      socket.off("recordsUpdated");
      socket.off("error");
      socket.close();
    };
  }, []); // Empty dependency array since we want this to run once on mount

  return (
    <Container size="xl" py="xl">
      <Group justify="space-between" mb="xl">
        <Title order={1}>Scratchpad</Title>
        <Button onClick={pushChanges}>Push Changes</Button>
      </Group>

      {error && (
        <Text color="red" size="sm" mb="md">
          {error}
        </Text>
      )}

      {!loading && !error && records && (
        <RecordsGridWithNoSSR
          records={records}
          onUpdate={updateRecord}
          onDelete={deleteRecord}
        />
      )}
      {loading && (
        <Text ta="center" mt="md">
          Loading...
        </Text>
      )}
    </Container>
  );
}
