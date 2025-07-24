/* eslint-disable @next/next/no-async-client-component */
'use client';

import { useCsvFile } from '@/hooks/use-csv-file';
import { csvFileApi } from '@/lib/api/csv-file';
import { Alert, Button, Group, LoadingOverlay, Paper, Stack, TextInput, Textarea, Title } from '@mantine/core';
import { ArrowLeft, FloppyDisk } from '@phosphor-icons/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function CsvFilePage({ params }: any) {
  const { id } = params;

  return <CsvFileContent id={id} />;
}

function CsvFileContent({ id }: { id: string }) {
  const { csvFile, isLoading, error, mutate } = useCsvFile(id);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (csvFile) {
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

  return (
    <Paper p="md">
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Button variant="light" leftSection={<ArrowLeft size={16} />} component={Link} href="/csv-files">
              Back
            </Button>
            <Title order={2}>{csvFile.name}</Title>
          </Group>
          <Button leftSection={<FloppyDisk size={16} />} onClick={handleSave} loading={isSaving}>
            Save
          </Button>
        </Group>

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
    </Paper>
  );
}
