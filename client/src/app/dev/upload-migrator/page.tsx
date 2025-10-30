'use client';

import { ButtonPrimaryLight } from '@/app/components/base/buttons';
import { TextSmBook } from '@/app/components/base/text';
import { devToolsApi } from '@/lib/api/dev-tools';
import { Alert, Group, Stack } from '@mantine/core';
import { useState } from 'react';
import MainContent from '../../components/layouts/MainContent';

const UploadMigratorToolPage = () => {
  const [results, setResults] = useState<{ actor: { userId: string; organizationId: string }; result: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const handleMigrateUploads = async () => {
    try {
      setRunning(true);
      setResults([]);
      const data = await devToolsApi.migrateUploadsToOrganization();
      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to migrate uploads');
    } finally {
      setRunning(false);
    }
  };

  return (
    <MainContent>
      <MainContent.BasicHeader title="Upload Migrator Tool" />
      <MainContent.Body>
        <Stack gap="md">
          <ButtonPrimaryLight onClick={handleMigrateUploads} loading={running}>
            Migrate Uploads
          </ButtonPrimaryLight>
          {error && <Alert color="red">{error}</Alert>}
          {results && (
            <Stack p="md">
              {results.map((result) => (
                <Group key={result.actor.userId}>
                  <TextSmBook>{result.actor.userId}</TextSmBook>
                  <TextSmBook>{result.actor.organizationId}</TextSmBook>
                  <TextSmBook>{result.result}</TextSmBook>
                </Group>
              ))}
            </Stack>
          )}
        </Stack>
      </MainContent.Body>
    </MainContent>
  );
};

export default UploadMigratorToolPage;
