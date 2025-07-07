"use client";

import { useState, useEffect, useRef } from "react";
import {
  Paper,
  TextInput,
  Stack,
  Text,
  Group,
  ScrollArea,
  ActionIcon,
  Badge,
  Alert,
  Select,
} from "@mantine/core";
import {
  ChatCircle,
  PaperPlaneRightIcon,
  Plus,
  X,
  XIcon,
} from "@phosphor-icons/react";
import { useScratchPadUser } from "@/hooks/useScratchpadUser";
import { ChatSessionSummary } from "@/types/server-entities/chat-session";

interface ChatMessage {
  role: "user" | "assistant";
  message: string;
  timestamp: string;
  emotion?: string;
}

interface ChatSession {
  id: string;
  name: string;
  history: ChatMessage[];
  important_facts: string[];
  created_at: string;
  last_activity: string;
  snapshot_id?: string;
}

interface AIChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotId?: string;
}

const AI_CHAT_SERVER_URL =
  process.env.NEXT_PUBLIC_AI_CHAT_SERVER_URL || "http://localhost:8000";

export default function AIChatPanel({
  isOpen,
  onClose,
  snapshotId,
}: AIChatPanelProps) {
  const textInputRef = useRef<HTMLInputElement>(null);
  const [resetInputFocus, setResetInputFocus] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Get user data including API token
  const { user } = useScratchPadUser();

  // Load sessions on mount
  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [sessionData?.history]);

  useEffect(() => {
    if (resetInputFocus) {
      textInputRef.current?.focus();
      setResetInputFocus(false);
    }
  }, [resetInputFocus]);

  const loadSessions = async () => {
    if (isLoadingSessions) return; // Prevent multiple simultaneous loads

    setIsLoadingSessions(true);
    try {
      console.log("Loading sessions from:", `${AI_CHAT_SERVER_URL}/sessions`);
      const response = await fetch(`${AI_CHAT_SERVER_URL}/sessions`);
      const data = await response.json();
      console.log("Sessions response:", data);
      setSessions(data.sessions);
      console.log("Set sessions:", data.sessions);
    } catch (error) {
      setError("Failed to load sessions");
      console.error("Error loading sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(
        `${AI_CHAT_SERVER_URL}/sessions/${sessionId}`
      );
      if (response.ok) {
        const data = (await response.json()) as ChatSession;
        setSessionData(data);
      } else {
        setError("Failed to load session");
      }
    } catch (error) {
      setError("Failed to load session");
      console.error("Error loading session:", error);
    }
  };

  useEffect(() => {
    if (currentSessionId) {
      loadSession(currentSessionId);
    }
  }, [currentSessionId]);

  const createNewSession = async () => {
    if (!snapshotId) {
      setError("Snapshot ID is required to create a session");
      return;
    }

    try {
      const url = new URL(`${AI_CHAT_SERVER_URL}/sessions`);
      url.searchParams.append("snapshot_id", snapshotId);

      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions((prev) => [...prev, data.session]);
        setCurrentSessionId(data.session.id);
        setError(null);
        console.log("Created new session with snapshot ID:", snapshotId);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(
          `Failed to create session: ${errorData.detail || response.statusText}`
        );
      }
    } catch (error) {
      setError("Failed to create session");
      console.error("Error creating session:", error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(
        `${AI_CHAT_SERVER_URL}/sessions/${sessionId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        setSessions((prev) =>
          prev.filter((session) => session.id !== sessionId)
        );
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          setSessionData(null);
        }
        setError(null);
      } else {
        setError("Failed to delete session");
      }
    } catch (error) {
      setError("Failed to delete session");
      console.error("Error deleting session:", error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !currentSessionId || isLoading) return;

    // Optimistically update chat history
    if (sessionData) {
      const optimisticMessage = {
        role: "user" as const,
        message: message.trim(),
        timestamp: new Date().toISOString(),
      };
      setSessionData({
        ...sessionData,
        history: [...sessionData.history, optimisticMessage],
      });
    }

    setIsLoading(true);
    setError(null);

    console.log("Message data:", {
      message: message.trim(),
      currentSessionId,
      historyLength: sessionData?.history.length || 0,
      hasApiToken: !!user?.apiToken,
      snapshotId: snapshotId,
    });

    try {
      const messageData: { message: string; api_token?: string } = {
        message: message.trim(),
      };

      // Include API token if available
      if (user?.apiToken) {
        messageData.api_token = user.apiToken;
        console.log("Including API token in request");
      } else {
        console.log("No API token available");
      }

      const response = await fetch(
        `${AI_CHAT_SERVER_URL}/sessions/${currentSessionId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messageData),
        }
      );

      if (response.ok) {
        setMessage("");

        // Reload session to get updated history
        await loadSession(currentSessionId);
        console.log("Message sent successfully, reloaded session");
      } else {
        setError("Failed to send message");
      }
    } catch (error) {
      setError("Failed to send message");
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
      setResetInputFocus(true);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const getEmotionColor = (emotion: string) => {
    const emotionColors: Record<string, string> = {
      happy: "green",
      excited: "blue",
      sad: "gray",
      angry: "red",
      neutral: "gray",
      friendly: "teal",
      helpful: "indigo",
    };
    return emotionColors[emotion.toLowerCase()] || "gray";
  };

  const formatSessionLabel = (session: ChatSessionSummary) => {
    return session.name;
    // const date = new Date(parseInt(sessionId.split('_')[1]));
    // return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  if (!isOpen) return null;

  return (
    <Paper
      shadow="md"
      p="md"
      style={{
        width: "30%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "visible",
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Text fw={500} size="sm">
          AI Chat
          {snapshotId && (
            <Text span size="xs" c="dimmed" ml="xs">
              (Snapshot: {snapshotId.slice(0, 8)}...)
            </Text>
          )}
        </Text>
        <ActionIcon onClick={onClose} size="sm" variant="subtle">
          <XIcon size={16} />
        </ActionIcon>
      </Group>

      {/* Error Alert */}
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {/* Session Management */}
      <Group mb="md" gap="xs" style={{}}>
        <Select
          placeholder="Select session"
          value={currentSessionId}
          onChange={(value) => {
            console.log("Select onChange called with:", value);
            setCurrentSessionId(value);
          }}
          data={sessions.map((session) => ({
            value: session.id,
            label: formatSessionLabel(session),
          }))}
          size="xs"
          style={{ flex: 1, zIndex: 10001 }}
          searchable={false}
          clearable={false}
          allowDeselect={true}
          maxDropdownHeight={200}
          styles={{
            dropdown: {
              zIndex: 10002,
            },
          }}
        />
        <ActionIcon
          onClick={createNewSession}
          size="sm"
          variant="subtle"
          title="New chat"
        >
          <Plus size={14} />
        </ActionIcon>
        {currentSessionId && (
          <ActionIcon
            onClick={() => deleteSession(currentSessionId)}
            size="sm"
            variant="subtle"
            color="red"
            title="Delete session"
          >
            <X size={14} />
          </ActionIcon>
        )}
      </Group>

      {/* Debug info */}
      <Text size="xs" c="dimmed" mb="xs">
        Sessions: {sessions.length} | Current: {currentSessionId || "none"}
      </Text>

      {/* Messages */}
      <ScrollArea flex={1} ref={scrollAreaRef} mb="md">
        {currentSessionId ? (
          <Stack gap="xs">
            {sessionData?.history.map((msg, index) => (
              <Paper
                key={index}
                p="xs"
                bg={msg.role === "user" ? "blue.0" : "gray.0"}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                }}
              >
                <Stack gap="xs">
                  <Text size="xs">{msg.message}</Text>
                  {msg.emotion && (
                    <Badge
                      size="xs"
                      color={getEmotionColor(msg.emotion)}
                      variant="light"
                    >
                      {msg.emotion}
                    </Badge>
                  )}
                  <Text size="xs" c="dimmed">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </Text>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Stack align="center" justify="center" h="100%">
            <ChatCircle size={32} color="#00A2E9" />
            <Text size="sm" fw={500} ta="center">
              Select a session or create a new one to start chatting
            </Text>
          </Stack>
        )}
      </ScrollArea>

      {/* Input Area */}
      <Group gap="xs" align="center">
        <TextInput
          ref={textInputRef}
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyUp={handleKeyPress}
          style={{ flex: 1 }}
          disabled={isLoading || !currentSessionId}
          size="xs"
        />
        <ActionIcon
          onClick={sendMessage}
          disabled={!message.trim() || isLoading || !currentSessionId}
          loading={isLoading}
          size="md"
        >
          <PaperPlaneRightIcon size={16} />
        </ActionIcon>
      </Group>
    </Paper>
  );
}
