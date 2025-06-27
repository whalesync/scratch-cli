"use client";

import { useState, useEffect, useRef } from "react";
import {
  Container,
  Paper,
  TextInput,
  Button,
  Stack,
  Text,
  Group,
  ScrollArea,
  ActionIcon,
  Badge,
  Loader,
} from "@mantine/core";
import {
  ChatCircle,
  PaperPlaneRight,
  Trash,
  Plus,
} from "@phosphor-icons/react";
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

const AI_CHAT_SERVER_URL =
  process.env.NEXT_PUBLIC_AI_CHAT_SERVER_URL || "http://localhost:8000";

export default function ChatPage() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Get user data including API token
  const { user } = useScratchPadUser();

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const response = await fetch(`${AI_CHAT_SERVER_URL}/sessions`);
      const data = await response.json();
      setSessions(data.sessions);

      // If no current session and sessions exist, select the first one
      if (!currentSession && data.sessions.length > 0) {
        setCurrentSession(data.sessions[0]);
      }
    } catch (error) {
      console.error("Error loading sessions:", error);
    }
  };

  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(
        `${AI_CHAT_SERVER_URL}/sessions/${sessionId}`
      );
      if (response.ok) {
        const data = await response.json();
        setSessionData(data);
      }
    } catch (error) {
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
      const response = await fetch(`${AI_CHAT_SERVER_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSessions((prev) => [...prev, data.session_id]);
        setCurrentSession(data.session_id);
        console.log("Created new standalone session (no snapshot ID)");
      }
    } catch (error) {
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
        setSessions((prev) => prev.filter((id) => id !== sessionId));
        if (currentSession === sessionId) {
          setCurrentSession(null);
          setSessionData(null);
        }
      }
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !currentSession || isLoading) return;

    setIsLoading(true);

    console.log("Message data:", {
      message: message.trim(),
      currentSession,
      historyLength: sessionData?.history.length || 0,
      hasApiToken: !!user?.apiToken,
      snapshotId: "standalone",
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
        `${AI_CHAT_SERVER_URL}/sessions/${currentSession}/messages`,
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
        await loadSession(currentSession);
      }
    } catch (error) {
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

  return (
    <Container size="xl" py="xl">
      <Stack h="calc(100vh - 100px)">
        <Group>
          {/* Sessions Panel */}
          <Paper p="md" w="25%" h="100%">
            <Stack h="100%">
              <Group justify="space-between">
                <Text fw={500}>Sessions (Standalone)</Text>
                <Button
                  size="xs"
                  variant="light"
                  leftSection={<Plus size={16} />}
                  onClick={createNewSession}
                >
                  New Chat
                </Button>
              </Group>

              <ScrollArea flex={1}>
                <Stack gap="xs">
                  {sessions.map((sessionId) => (
                    <Paper
                      key={sessionId}
                      p="xs"
                      bg={currentSession === sessionId ? "blue.0" : "gray.0"}
                      style={{ cursor: "pointer" }}
                      onClick={() => setCurrentSession(sessionId)}
                    >
                      <Group justify="space-between">
                        <Text size="sm" truncate>
                          Session {sessionId.split("_")[1]}
                        </Text>
                        <ActionIcon
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(sessionId);
                          }}
                        >
                          <Trash size={12} />
                        </ActionIcon>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
          </Paper>

          <Paper p="md" style={{ flex: 1 }} h="100%">
            {currentSession ? (
              <Stack h="100%">
                {/* Messages */}
                <ScrollArea h="calc(100% - 80px)" ref={scrollAreaRef}>
                  <Stack gap="md">
                    {sessionData?.history.map((msg, index) => (
                      <Paper
                        key={index}
                        p="md"
                        bg={msg.role === "user" ? "blue.0" : "gray.0"}
                        style={{
                          alignSelf:
                            msg.role === "user" ? "flex-end" : "flex-start",
                          maxWidth: "80%",
                        }}
                      >
                        <Stack gap="xs">
                          <Text size="sm">{msg.message}</Text>
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
                </ScrollArea>

                {/* Input Area */}
                <Group>
                  <TextInput
                    placeholder="Type your message..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    style={{ flex: 1 }}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={!message.trim() || isLoading}
                    leftSection={
                      isLoading ? (
                        <Loader size={16} />
                      ) : (
                        <PaperPlaneRight size={16} />
                      )
                    }
                  >
                    Send
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Stack align="center" justify="center" h="100%">
                <ChatCircle size={48} color="#00A2E9" />
                <Text size="lg" fw={500}>
                  Select a session or create a new one to start chatting
                </Text>
                <Text size="sm" c="dimmed">
                  This is a standalone chat session (not associated with any
                  snapshot)
                </Text>
                <Button
                  onClick={createNewSession}
                  leftSection={<Plus size={16} />}
                >
                  Create New Chat
                </Button>
              </Stack>
            )}
          </Paper>
        </Group>
      </Stack>
    </Container>
  );
}
