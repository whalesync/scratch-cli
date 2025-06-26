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
  Alert,
} from "@mantine/core";
import { ChatCircle, PaperPlaneRight, Trash, Plus } from "@phosphor-icons/react";

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
}

const CHAT_SERVER_URL = "http://localhost:8000";

export default function ChatPage() {
  const [sessions, setSessions] = useState<string[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
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
      const response = await fetch(`${CHAT_SERVER_URL}/sessions`, {
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

    try {
      const response = await fetch(`${CHAT_SERVER_URL}/sessions/${currentSession}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (response.ok) {
        setMessage("");
        
        // Reload session to get updated history
        await loadSession(currentSession);
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

  return (
    <Container size="xl" h="100vh" py="md">
      <Stack h="100%">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group>
            <ChatCircle size={24} color="#00A2E9" />
            <Text size="xl" fw={600}>
              AI Chat
            </Text>
          </Group>
          <Button
            leftSection={<Plus size={16} />}
            onClick={createNewSession}
            variant="light"
          >
            New Chat
          </Button>
        </Group>

        {/* Error Alert */}
        {error && (
          <Alert color="red" title="Error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Group align="flex-start" h="calc(100vh - 200px)">
          {/* Sessions Sidebar */}
          <Paper p="md" w={250} h="100%">
            <Text size="sm" fw={500} mb="md">
              Sessions
            </Text>
            <Stack gap="xs">
              {sessions.map((sessionId) => (
                <Group key={sessionId} justify="space-between">
                  <Button
                    variant={currentSession === sessionId ? "filled" : "light"}
                    size="xs"
                    onClick={() => setCurrentSession(sessionId)}
                    style={{ flex: 1, justifyContent: "flex-start" }}
                  >
                    {sessionId.slice(0, 20)}...
                  </Button>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => deleteSession(sessionId)}
                  >
                    <Trash size={12} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </Paper>

          {/* Chat Area */}
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
                          alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
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
                    leftSection={isLoading ? <Loader size={16} /> : <PaperPlaneRight size={16} />}
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
                <Button onClick={createNewSession} leftSection={<Plus size={16} />}>
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