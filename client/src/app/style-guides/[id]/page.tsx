'use client';

import { useStyleGuide } from '@/hooks/use-style-guide';
import { styleGuideApi } from '@/lib/api/style-guide';
import { RouteUrls } from '@/utils/route-urls';
import { Alert, Button, LoadingOverlay, Paper, Stack, Text } from '@mantine/core';
import { FloppyDiskIcon } from '@phosphor-icons/react';
import MDEditor from '@uiw/react-md-editor';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ContentContainer } from '../../components/ContentContainer';

export default function StyleGuideEditPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { styleGuide, isLoading, error, mutate } = useStyleGuide(id);
  const [content, setContent] = useState('');
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
      setSaveError('Failed to save style guide');
      console.error('Error saving style guide:', error);
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

  const actions = (
    <Button leftSection={<FloppyDiskIcon size={16} />} onClick={handleSave} loading={isSaving}>
      Save
    </Button>
  );

  return (
    <ContentContainer
      title={styleGuide.name}
      actions={actions}
      onBack={() => router.push(RouteUrls.styleGuidesPageUrl)}
    >
      <Stack>
        {saveError && (
          <Alert color="red" title="Error">
            {saveError}
          </Alert>
        )}

        <div data-color-mode="light">
          <MDEditor value={content} onChange={(value) => setContent(value || '')} height={600} preview="edit" />
        </div>
      </Stack>
    </ContentContainer>
  );
}
