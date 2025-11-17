'use client';

import { codeMigrationsApi } from '@/lib/api/code-migrations';
import {
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { SettingsPanel } from './SettingsPanel';

export const MigrationsPanel = () => {
  const [availableMigrations, setAvailableMigrations] = useState<string[]>([]);
  const [isLoadingMigrations, setIsLoadingMigrations] = useState(true);
  const [selectedMigration, setSelectedMigration] = useState<string | null>(null);
  const [qty, setQty] = useState<number | string>(5);
  const [ids, setIds] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    loadAvailableMigrations();
  }, []);

  const loadAvailableMigrations = async () => {
    try {
      const response = await codeMigrationsApi.getAvailableMigrations();
      setAvailableMigrations(response.migrations);
    } catch (error) {
      console.error('Failed to load migrations:', error);
    } finally {
      setIsLoadingMigrations(false);
    }
  };

  const handleRunMigration = async () => {
    if (!selectedMigration) {
      notifications.show({
        title: 'Error',
        message: 'Please select a migration',
        color: 'red',
      });
      return;
    }

    // Parse IDs if provided
    const idsArray = ids
      .trim()
      .split(/[\s,]+/)
      .filter((id) => id.length > 0);

    // Validate that either qty or ids is provided
    if (!qty && idsArray.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please provide either quantity or IDs',
        color: 'red',
      });
      return;
    }

    if (qty && idsArray.length > 0) {
      notifications.show({
        title: 'Error',
        message: 'Please provide either quantity OR IDs, not both',
        color: 'red',
      });
      return;
    }

    setIsRunning(true);

    try {
      const result = await codeMigrationsApi.runMigration({
        migration: selectedMigration,
        qty: qty ? Number(qty) : undefined,
        ids: idsArray.length > 0 ? idsArray : undefined,
      });

      notifications.show({
        title: 'Migration completed',
        message: `Migrated ${result.migratedIds.length} items. ${result.remainingCount} remaining.`,
        color: 'green',
      });

      // Reset form
      setQty(5);
      setIds('');
    } catch (error) {
      console.error('Migration error:', error);
      notifications.show({
        title: 'Migration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <SettingsPanel title="Migrations" subtitle="Run database migrations to update schemas">
      <Stack gap="md">

        <Select
          label="Migration"
          placeholder="Select a migration"
          data={availableMigrations.map((m) => ({ value: m, label: m }))}
          value={selectedMigration}
          onChange={setSelectedMigration}
          disabled={isLoadingMigrations}
        />

        <NumberInput
          label="Quantity"
          description="Number of items to migrate (leave empty if using IDs)"
          placeholder="5"
          value={qty}
          onChange={setQty}
          min={1}
          max={1000}
          disabled={isRunning}
        />

        <Textarea
          label="IDs"
          description="Comma or space-separated list of IDs to migrate (leave empty if using quantity)"
          placeholder="snt_abc123, snt_def456"
          value={ids}
          onChange={(e) => setIds(e.currentTarget.value)}
          disabled={isRunning}
          rows={3}
        />

        <Group>
          <Button
            onClick={handleRunMigration}
            loading={isRunning}
            disabled={!selectedMigration}
          >
            Run Migration
          </Button>
        </Group>
      </Stack>
    </SettingsPanel>
  );
};
