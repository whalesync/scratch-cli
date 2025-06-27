"use client";

import { useState, useEffect, useRef } from "react";
import { Container, Title, Text, Button, Group } from "@mantine/core";
import { io, Socket } from "socket.io-client";
import dynamic from "next/dynamic";
import { API_CONFIG } from "@/lib/api/config";

interface DataRecord {
  id: string;
  remote: Record<string, unknown>;
  staged: Record<string, unknown> | null | undefined;
  suggested: Record<string, unknown> | null | undefined;
}

// This is a workaround to avoid the server-side rendering of the RecordsGrid component and allow Next.js to prerender the page
const RecordsGridWithNoSSR = dynamic(
  () => import("../components/RecordsGrid"),
  {
    ssr: false,
  }
);

/**
 * @deprecated This page is no longer used.
 */
export default function Home() {
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const socketRef = useRef<Socket | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    setError("");
    try {
      const url = `${API_CONFIG.getApiUrl()}/records`;
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...API_CONFIG.getAuthHeaders(),
        },
      });
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

  const updateRecord = async (id: string, data: Record<string, unknown>) => {
    try {
      const response = await fetch(`${API_CONFIG.getApiUrl()}/records/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...API_CONFIG.getAuthHeaders(),
        },
        body: JSON.stringify({ stage: true, data }),
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
          ...API_CONFIG.getAuthHeaders(),
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
        headers: {
          "Content-Type": "application/json",
          ...API_CONFIG.getAuthHeaders(),
        },
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

    // Initialize WebSocket connection
    console.log("Initializing WebSocket connection...");
    socketRef.current = io(API_CONFIG.getApiUrl(), {
      transports: ["websocket"],
    });

    const socket = socketRef.current;

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

    socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      setError("WebSocket connection error");
    });

    socket.on("disconnect", (reason) => {
      console.log("WebSocket disconnected:", reason);
    });

    // Cleanup function
    return () => {
      console.log("Cleaning up WebSocket connection...");
      if (socket) {
        socket.off("connect");
        socket.off("recordsUpdated");
        socket.off("error");
        socket.off("connect_error");
        socket.off("disconnect");
        socket.close();
      }
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
