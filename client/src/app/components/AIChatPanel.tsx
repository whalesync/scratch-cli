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
import { ChatCircle, PaperPlaneRight, Plus, X } from "@phosphor-icons/react";
import { useScratchPadUser } from "@/hooks/useScratchpadUser";

interface ChatMessage {
  role: "user" | "assistant";
  message: string;
  timestamp: string;
  emotion?: string;
}

interface ChatSession {
  id: string;
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

const CHAT_SERVER_URL = "http://localhost:8000";

export default function AIChatPanel({ isOpen, onClose, snapshotId }: AIChatPanelProps) {
  const [sessions, setSessions] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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

  const loadSessions = async () => {
    try {
      const response = await fetch(`${CHAT_SERVER_URL}/sessions`);
      const data = await response.json();
      setSessions(data.sessions);
      
      // If no current session and sessions exist, select the first one
      if (!currentSession && data.sessions.length > 0) {
        setCurrentSession(data.sessions[0]);
      }
    } catch (error) {
      setError("Failed to load sessions");
      console.error("Error loading sessions:", error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${CHAT_SERVER_URL}/sessions/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
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
    if (currentSession) {
      loadSession(currentSession);
    }
  }, [currentSession]);

  const createNewSession = async () => {
    try {
      const url = new URL(`${CHAT_SERVER_URL}/sessions`);
      if (snapshotId) {
        url.searchParams.append('snapshot_id', snapshotId);
      }
      
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSessions(prev => [...prev, data.session_id]);
        setCurrentSession(data.session_id);
        setError(null);
        console.log("Created new session with snapshot ID:", snapshotId);
      } else {
        setError("Failed to create session");
      }
    } catch (error) {
      setError("Failed to create session");
      console.error("Error creating session:", error);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${CHAT_SERVER_URL}/sessions/${sessionId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        setSessions(prev => prev.filter(id => id !== sessionId));
        if (currentSession === sessionId) {
          setCurrentSession(null);
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
    if (!message.trim() || !currentSession || isLoading) return;

    setIsLoading(true);
    setError(null);

    console.log("Message data:", {
      message: message.trim(),
      currentSession,
      historyLength: sessionData?.history.length || 0,
      hasApiToken: !!user?.apiToken,
      snapshotId: snapshotId
    });

    try {
      const messageData: { message: string; api_token?: string } = {
        message: message.trim()
      };
      
      // Include API token if available
      if (user?.apiToken) {
        messageData.api_token = user.apiToken;
        console.log("Including API token in request");
      } else {
        console.log("No API token available");
      }

      const response = await fetch(`${CHAT_SERVER_URL}/sessions/${currentSession}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        setMessage("");
        
        // Reload session to get updated history
        await loadSession(currentSession);
        console.log("Message sent successfully, reloaded session");
      } else {
        setError("Failed to send message");
      }
    } catch (error) {
      setError("Failed to send message");
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
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

  const formatSessionLabel = (sessionId: string) => {
    const date = new Date(parseInt(sessionId.split('_')[1]));
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  };

  if (!isOpen) return null;

  return (
    <Paper
      shadow="md"
      p="md"
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        width: "30%",
        height: "100vh",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
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
          <X size={16} />
        </ActionIcon>
      </Group>

      {/* Error Alert */}
      {error && (
        <Alert color="red" mb="md">
          {error}
        </Alert>
      )}

      {/* Session Management */}
      <Group mb="md" gap="xs">
        <Select
          placeholder="Select session"
          value={currentSession}
          onChange={setCurrentSession}
          data={sessions.map(id => ({ value: id, label: formatSessionLabel(id) }))}
          size="xs"
          style={{ flex: 1 }}
        />
        <ActionIcon
          onClick={createNewSession}
          size="sm"
          variant="subtle"
          title="New chat"
        >
          <Plus size={14} />
        </ActionIcon>
        {currentSession && (
          <ActionIcon
            onClick={() => deleteSession(currentSession!)}
            size="sm"
            variant="subtle"
            color="red"
            title="Delete session"
          >
            <X size={14} />
          </ActionIcon>
        )}
      </Group>

      {/* Messages */}
      <ScrollArea flex={1} ref={scrollAreaRef} mb="md">
        {currentSession ? (
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
      <Group>
        <TextInput
          placeholder="Type your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          style={{ flex: 1 }}
          disabled={isLoading || !currentSession}
          size="xs"
        />
        <ActionIcon
          onClick={sendMessage}
          disabled={!message.trim() || isLoading || !currentSession}
          loading={isLoading}
          size="sm"
        >
          <PaperPlaneRight size={14} />
        </ActionIcon>
      </Group>
    </Paper>
  );
} 