'use client';

import { ContentContainer } from '@/app/components/ContentContainer';
import { useCsvFile } from '@/hooks/use-csv-file';
import { csvFileApi } from '@/lib/api/csv-file';
import { RouteUrls } from '@/utils/route-urls';
import { Alert, Button, LoadingOverlay, Paper, Stack, TextInput, Textarea } from '@mantine/core';
import { FloppyDiskIcon } from '@phosphor-icons/react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function CsvFilePage() {
  const params = useParams<{ id: string }>();
  return <CsvFileContent id={params.id} />;
}

function CsvFileContent({ id }: { id: string }) {
  const { csvFile, isLoading, error, mutate } = useCsvFile(id);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (csvFile && !isLoading && !csvFile.body && !csvFile.name) {
      setName(csvFile.name);
      setBody(csvFile.body);
    }
  }, [csvFile]);

  const handleSave = async () => {
    if (!csvFile) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await csvFileApi.update(csvFile.id, {
        name,
        body,
      });
      mutate();
    } catch (error) {
      setSaveError('Failed to save CSV file');
      console.error('Error saving CSV file:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (error) {
    return (
      <Paper p="md">
        <Alert color="red" title="Error">
          Failed to load CSV file
        </Alert>
      </Paper>
    );
  }

  if (isLoading || !csvFile) {
    return (
      <Paper p="md" pos="relative" style={{ minHeight: 200 }}>
        <LoadingOverlay visible />
      </Paper>
    );
  }

  const actions = (
    <Button leftSection={<FloppyDiskIcon size={16} />} onClick={handleSave} loading={isSaving}>
      Save
    </Button>
  );

  return (
    <ContentContainer title={csvFile.name} actions={actions} onBack={() => router.push(RouteUrls.csvFilesPageUrl)}>
      <Stack gap="md">
        {saveError && (
          <Alert color="red" title="Error">
            {saveError}
          </Alert>
        )}

        <TextInput
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter CSV file name"
        />

        <Textarea
          label="CSV Content"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Enter CSV content here..."
          minRows={20}
          rows={20}
          styles={{
            input: {
              fontFamily: 'monospace',
              fontSize: '14px',
            },
          }}
        />
      </Stack>
    </ContentContainer>
  );
}
