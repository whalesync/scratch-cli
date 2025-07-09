"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Paper,
  Title,
  Button,
  Group,
  Stack,
  Alert,
  Text,
  LoadingOverlay,
} from "@mantine/core";
import { ArrowLeft, FloppyDisk } from "@phosphor-icons/react";
import Link from "next/link";
import MDEditor from "@uiw/react-md-editor";
import { useStyleGuide } from "@/hooks/use-style-guide";
import { styleGuideApi } from "@/lib/api/style-guide";
import { RouteUrls } from "@/utils/route-urls";

export default function StyleGuideEditPage() {
  const params = useParams();
  const id = params.id as string;
  
  const { styleGuide, isLoading, error, mutate } = useStyleGuide(id);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (styleGuide) {
      setContent(styleGuide.body);
    }
  }, [styleGuide]);

  const handleSave = async () => {
    if (!styleGuide) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await styleGuideApi.update(styleGuide.id, {
        body: content,
      });
      
      mutate();
    } catch (error) {
      setSaveError("Failed to save style guide");
      console.error("Error saving style guide:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <Paper p="md">
        <Alert color="red" title="Error">
          Failed to load style guide
        </Alert>
      </Paper>
    );
  }

  if (isLoading || !styleGuide) {
    return (
      <Paper p="md" pos="relative">
        <LoadingOverlay visible />
        <Text>Loading...</Text>
      </Paper>
    );
  }

  return (
    <Paper p="md">
      <Stack>
        <Group justify="space-between">
          <Group>
            <Button
              component={Link}
              href={RouteUrls.styleGuidesPageUrl}
              variant="subtle"
              leftSection={<ArrowLeft size={16} />}
            >
              Back
            </Button>
            <Title order={2}>{styleGuide.name}</Title>
          </Group>
          <Button
            leftSection={<FloppyDisk size={16} />}
            onClick={handleSave}
            loading={isSaving}
          >
            Save
          </Button>
        </Group>

        {saveError && (
          <Alert color="red" title="Error">
            {saveError}
          </Alert>
        )}

        <div data-color-mode="light">
          <MDEditor
            value={content}
            onChange={(value) => setContent(value || "")}
            height={600}
            preview="edit"
          />
        </div>
      </Stack>
    </Paper>
  );
} 