'use client';

import { Text13Medium } from '@/app/components/base/text';
import { ComingSoonBadge } from '@/app/components/ComingSoonBadge';
import { useDataFolders } from '@/hooks/use-data-folders';
import { syncApi } from '@/lib/api/sync';
import { workbookApi } from '@/lib/api/workbook';
import { useSyncStore } from '@/stores/sync-store';
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Group,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { SyncId, WorkbookId } from '@spinner/shared-types';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Database,
  PlayIcon,
  Plus,
  RefreshCwIcon,
  Search,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

interface SyncEditorProps {
  workbookId: WorkbookId;
  syncId: SyncId | 'new';
}

interface FieldMapping {
  id: string;
  sourceField: string;
  destField: string;
}

interface FolderPair {
  id: string;
  sourceId: string;
  destId: string;
  fieldMappings: FieldMapping[];
  matchingDestinationField: string;
  matchingSourceField: string;
  expanded: boolean;
}

// Helpers
let mappingIdCounter = 0;
const createMapping = (sourceField = '', destField = ''): FieldMapping => ({
  id: `mapping-${++mappingIdCounter}`,
  sourceField,
  destField,
});

let pairIdCounter = 0;
const createPair = (): FolderPair => ({
  id: `pair-${++pairIdCounter}`,
  sourceId: '',
  destId: '',
  fieldMappings: [createMapping()],
  matchingDestinationField: '',
  matchingSourceField: '',
  expanded: true,
});

interface ScheduleOption {
  value: string;
  label: string;
  disabled?: boolean;
}

const SCHEDULE_OPTIONS: ScheduleOption[] = [
  { value: '', label: 'Manual only' },
  { value: '*/5 * * * *', label: 'Every 5 minutes', disabled: true },
  { value: '*/15 * * * *', label: 'Every 15 minutes', disabled: true },
  { value: '0 * * * *', label: 'Every hour', disabled: true },
  { value: '0 0 * * *', label: 'Daily at midnight', disabled: true },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderAutocompleteOption = ({ option }: any) => (
  <Group gap="sm" wrap="nowrap">
    <Badge size="xs" variant="light" color="blue" w={70} style={{ flexShrink: 0 }}>
      {option.type}
    </Badge>
    <Text size="sm">{option.value}</Text>
  </Group>
);

export function SyncEditor({ workbookId, syncId }: SyncEditorProps) {
  const router = useRouter();
  const { dataFolderGroups } = useDataFolders();
  const syncs = useSyncStore((state) => state.syncs);
  const activeJobs = useSyncStore((state) => state.activeJobs);
  const fetchSyncs = useSyncStore((state) => state.fetchSyncs);
  const runSync = useSyncStore((state) => state.runSync);

  const isNew = syncId === 'new';
  const existingSync = useMemo(() => syncs.find((s) => s.id === syncId), [syncs, syncId]);
  const isRunning = !isNew && !!activeJobs[syncId];

  const [folderPairs, setFolderPairs] = useState<FolderPair[]>([createPair()]);
  const [syncName, setSyncName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [autoPublish, setAutoPublish] = useState(true);
  const [enableValidation, setEnableValidation] = useState(true);

  const [saving, setSaving] = useState(false);
  const [schemaCache, setSchemaCache] = useState<Record<string, { path: string; type: string }[]>>({});

  // Flatten folders for easy selection
  const allFolders = dataFolderGroups.flatMap((g) => g.dataFolders);

  // Fetch schema paths if not in cache
  const ensureSchemaPaths = async (folderId: string) => {
    if (!folderId || schemaCache[folderId]) return;

    const paths = await workbookApi.getSchemaPaths(folderId);
    setSchemaCache((prev) => ({ ...prev, [folderId]: paths }));
  };

  // Initialize from existing sync
  useEffect(() => {
    if (isNew) {
      setFolderPairs([createPair()]);
      setSyncName('');
      setSchedule('');
      setAutoPublish(true);
      setEnableValidation(true);
      return;
    }

    if (!existingSync) return;

    setSyncName(existingSync.displayName);
    setSchedule('');

    if (existingSync.mappings && existingSync.mappings.tableMappings) {
      const uniqueFolderIds = new Set<string>();
      const pairs: FolderPair[] = existingSync.mappings.tableMappings.map((tm) => {
        uniqueFolderIds.add(tm.sourceDataFolderId);
        uniqueFolderIds.add(tm.destinationDataFolderId);

        const fieldMappings: FieldMapping[] = tm.columnMappings
          .filter((cm) => cm.type === 'local')
          .map((cm) => ({
            id: `mapping-${++mappingIdCounter}`,
            sourceField: cm.sourceColumnId,
            destField: cm.destinationColumnId,
          }));

        return {
          id: `pair-${++pairIdCounter}`,
          sourceId: tm.sourceDataFolderId,
          destId: tm.destinationDataFolderId,
          fieldMappings: fieldMappings.length ? fieldMappings : [createMapping()],
          matchingDestinationField: tm.recordMatching?.destinationColumnId || '',
          matchingSourceField: tm.recordMatching?.sourceColumnId || '',
          expanded: true,
        };
      });
      setFolderPairs(pairs.length ? pairs : [createPair()]);
      uniqueFolderIds.forEach((id) => ensureSchemaPaths(id));
    } else if (existingSync.syncTablePairs) {
      const pairs: FolderPair[] = existingSync.syncTablePairs.map((p) => ({
        id: `pair-${++pairIdCounter}`,
        sourceId: p.sourceDataFolderId,
        destId: p.destinationDataFolderId,
        fieldMappings: [createMapping()],
        matchingDestinationField: '',
        matchingSourceField: '',
        expanded: true,
      }));
      setFolderPairs(pairs.length ? pairs : [createPair()]);
    } else {
      setFolderPairs([createPair()]);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncId, existingSync?.id]);

  // Auto-generate name for new syncs
  useEffect(() => {
    if (isNew && !syncName) {
      const validPairs = folderPairs.filter((p) => p.sourceId && p.destId);
      if (validPairs.length > 0) {
        const firstPair = validPairs[0];
        const sourceFolder = allFolders.find((f) => f.id === firstPair.sourceId);
        const destFolder = allFolders.find((f) => f.id === firstPair.destId);

        if (sourceFolder && destFolder) {
          const suffix = validPairs.length > 1 ? ` (+${validPairs.length - 1})` : '';
          setSyncName(`${sourceFolder.name} → ${destFolder.name}${suffix}`);
        }
      }
    }
  }, [isNew, folderPairs, allFolders, syncName]);

  const validPairsCount = folderPairs.filter((p) => {
    const hasValidMappings = p.fieldMappings.some((m) => m.sourceField && m.destField);
    return p.sourceId && p.destId && hasValidMappings;
  }).length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const validPairs = folderPairs.filter((p) => {
        const hasValidMappings = p.fieldMappings.some((m) => m.sourceField && m.destField);
        return p.sourceId && p.destId && hasValidMappings;
      });

      const folderMappings = validPairs.map((pair) => {
        const fieldMap: Record<string, string> = {};
        pair.fieldMappings.forEach((m) => {
          if (m.sourceField && m.destField) {
            fieldMap[m.sourceField] = m.destField;
          }
        });

        return {
          sourceId: pair.sourceId,
          destId: pair.destId,
          fieldMap,
          matchingDestinationField: pair.matchingDestinationField || null,
          matchingSourceField: pair.matchingSourceField || null,
        };
      });

      const payload = {
        name: syncName || 'Untitled Sync',
        folderMappings,
        schedule: schedule || null,
        autoPublish,
        enableValidation,
      };

      if (isNew) {
        const newSync = await syncApi.create(workbookId, payload);
        await fetchSyncs(workbookId);
        notifications.show({
          title: 'Sync created',
          message: `"${syncName}" has been created`,
          color: 'green',
        });
        router.push(`/workbook/${workbookId}/syncs/${newSync.id}`);
      } else {
        await syncApi.update(workbookId, syncId, payload);
        await fetchSyncs(workbookId);
        notifications.show({
          title: 'Sync updated',
          message: 'Changes have been saved',
          color: 'green',
        });
      }
    } catch (error) {
      console.debug('Error saving sync:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to save sync',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    if (!window.confirm(`Are you sure you want to delete "${syncName}"?`)) return;

    try {
      await syncApi.delete(workbookId, syncId);
      await fetchSyncs(workbookId);
      notifications.show({
        title: 'Sync deleted',
        message: `"${syncName}" has been deleted`,
        color: 'green',
      });
      router.push(`/workbook/${workbookId}/syncs`);
    } catch (error) {
      console.debug('Failed to delete sync:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to delete sync',
        color: 'red',
      });
    }
  };

  const handleRunSync = async () => {
    if (isNew) return;
    try {
      await runSync(workbookId, syncId);
      notifications.show({
        title: 'Sync started',
        message: 'Sync job has been queued',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Failed to start sync',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  // -- Pair Logic -- //
  const updatePair = (index: number, changes: Partial<FolderPair>) => {
    const next = [...folderPairs];
    next[index] = { ...next[index], ...changes };
    setFolderPairs(next);
  };

  const togglePairExpanded = (index: number) => {
    updatePair(index, { expanded: !folderPairs[index].expanded });
  };

  const removePair = (index: number) => {
    if (folderPairs.length > 1) {
      setFolderPairs(folderPairs.filter((_, i) => i !== index));
    }
  };

  const addFieldMapping = (pairIndex: number) => {
    const next = [...folderPairs];
    next[pairIndex].fieldMappings.push(createMapping());
    setFolderPairs(next);
  };

  const updateFieldMapping = (
    pairIndex: number,
    mappingIndex: number,
    field: 'sourceField' | 'destField',
    value: string,
  ) => {
    const next = [...folderPairs];
    next[pairIndex].fieldMappings[mappingIndex][field] = value;
    setFolderPairs(next);
  };

  const removeFieldMapping = (pairIndex: number, mappingIndex: number) => {
    const next = [...folderPairs];
    if (next[pairIndex].fieldMappings.length > 1) {
      next[pairIndex].fieldMappings = next[pairIndex].fieldMappings.filter((_, i) => i !== mappingIndex);
      setFolderPairs(next);
    }
  };

  const getFolderName = (id: string) => allFolders.find((f) => f.id === id)?.name || 'Unknown';

  const renderScheduleOption = ({ option }: { option: ScheduleOption }) => (
    <Group gap="sm" wrap="nowrap" justify="space-between" w="100%">
      <Text size="sm" c={option.disabled ? 'dimmed' : undefined}>
        {option.label}
      </Text>
      {option.disabled && <ComingSoonBadge />}
    </Group>
  );

  // Loading state
  if (!isNew && !existingSync) {
    return (
      <Box p="xl" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Text c="dimmed">Loading sync...</Text>
      </Box>
    );
  }

  return (
    <Stack h="100%" gap={0}>
      {/* Header */}
      <Group
        h={48}
        px="md"
        justify="space-between"
        style={{
          borderBottom: '1px solid var(--fg-divider)',
          flexShrink: 0,
        }}
      >
        <Text13Medium>{isNew ? 'New Sync' : syncName}</Text13Medium>
        <Group gap="xs">
          {!isNew && (
            <>
              <Button
                size="compact-xs"
                variant="light"
                color="blue"
                leftSection={
                  isRunning ? (
                    <RefreshCwIcon size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <PlayIcon size={12} />
                  )
                }
                onClick={handleRunSync}
                disabled={isRunning}
              >
                {isRunning ? 'Running...' : 'Run Now'}
              </Button>
              <Button
                size="compact-xs"
                variant="light"
                color="red"
                leftSection={<Trash2 size={12} />}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </>
          )}
          <Button size="compact-xs" onClick={handleSave} loading={saving} disabled={validPairsCount === 0}>
            {isNew ? 'Create' : 'Save'}
          </Button>
        </Group>
      </Group>

      {/* Content */}
      <ScrollArea style={{ flex: 1 }}>
        <Stack p="md" gap="lg">
          {/* Sync Name */}
          <TextInput
            label="Sync Name"
            placeholder="My Sync"
            value={syncName}
            onChange={(e) => {
              setSyncName(e.currentTarget.value);
            }}
          />

          {/* Folder Pairs */}
          <Stack gap="sm">
            <Text13Medium>Folder Pairs</Text13Medium>

            {folderPairs.map((pair, index) => (
              <Box
                key={pair.id}
                style={{
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 'var(--mantine-radius-md)',
                }}
              >
                {/* Header */}
                <Group
                  p="xs"
                  bg="var(--mantine-color-gray-0)"
                  style={{ cursor: 'pointer' }}
                  onClick={() => togglePairExpanded(index)}
                >
                  <ActionIcon variant="transparent" size="sm">
                    {pair.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </ActionIcon>
                  <Database size={14} color="var(--mantine-color-dimmed)" />
                  <Text13Medium style={{ flex: 1 }}>
                    {pair.sourceId && pair.destId
                      ? `${getFolderName(pair.sourceId)} → ${getFolderName(pair.destId)}`
                      : `Folder Pair ${index + 1}`}
                  </Text13Medium>
                  {folderPairs.length > 1 && (
                    <ActionIcon
                      color="red"
                      variant="subtle"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePair(index);
                      }}
                    >
                      <Trash2 size={14} />
                    </ActionIcon>
                  )}
                </Group>

                {/* Body */}
                <Collapse in={pair.expanded}>
                  <Stack p="md" gap="md">
                    <Group grow>
                      <Select
                        label="Source Folder"
                        placeholder="Select source"
                        data={allFolders
                          .filter((f) => f.id !== pair.destId)
                          .map((f) => ({ value: f.id, label: f.name }))}
                        value={pair.sourceId}
                        onChange={(val) => {
                          updatePair(index, { sourceId: val || '' });
                          if (val) ensureSchemaPaths(val);
                        }}
                        searchable
                      />
                      <Select
                        label="Destination Folder"
                        placeholder="Select destination"
                        data={allFolders
                          .filter((f) => f.id !== pair.sourceId)
                          .map((f) => ({ value: f.id, label: f.name }))}
                        value={pair.destId}
                        onChange={(val) => {
                          updatePair(index, { destId: val || '' });
                          if (val) ensureSchemaPaths(val);
                        }}
                        searchable
                      />
                    </Group>

                    <Stack gap="xs">
                      <Text13Medium>Field Mappings</Text13Medium>
                      <Text size="xs" c="dimmed">
                        Use dot notation for nested fields.
                      </Text>

                      {pair.fieldMappings.map((mapping, mIndex) => (
                        <Group key={mapping.id} gap="xs">
                          <Autocomplete
                            placeholder="Source field"
                            style={{ flex: 1 }}
                            value={mapping.sourceField}
                            onChange={(val) => updateFieldMapping(index, mIndex, 'sourceField', val)}
                            data={(schemaCache[pair.sourceId] || []).map((f) => {
                              if (typeof f === 'string') return { value: f, label: f, type: 'unknown' };
                              return { value: f.path, label: f.path, type: f.type };
                            })}
                            renderOption={renderAutocompleteOption}
                            rightSection={<Search size={14} color="var(--mantine-color-dimmed)" />}
                          />
                          <ArrowRight size={14} color="var(--mantine-color-dimmed)" />
                          <Autocomplete
                            placeholder="Dest field"
                            style={{ flex: 1 }}
                            value={mapping.destField}
                            onChange={(val) => updateFieldMapping(index, mIndex, 'destField', val)}
                            data={(schemaCache[pair.destId] || []).map((f) => {
                              if (typeof f === 'string') return { value: f, label: f, type: 'unknown' };
                              return { value: f.path, label: f.path, type: f.type };
                            })}
                            renderOption={renderAutocompleteOption}
                            rightSection={<Search size={14} color="var(--mantine-color-dimmed)" />}
                          />
                          {pair.fieldMappings.length > 1 && (
                            <ActionIcon variant="subtle" color="gray" onClick={() => removeFieldMapping(index, mIndex)}>
                              <Trash2 size={14} />
                            </ActionIcon>
                          )}
                        </Group>
                      ))}
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<Plus size={14} />}
                        onClick={() => addFieldMapping(index)}
                      >
                        Add Field Mapping
                      </Button>
                    </Stack>

                    <Select
                      label="Matching Field (Required)"
                      description="Select the field mapping to use for matching records"
                      placeholder="Select matching pair"
                      data={pair.fieldMappings
                        .filter((m) => m.sourceField && m.destField)
                        .map((m) => ({
                          value: m.sourceField,
                          label: `${m.sourceField} <-> ${m.destField}`,
                        }))}
                      value={pair.matchingSourceField}
                      onChange={(val) => {
                        const mapping = pair.fieldMappings.find((m) => m.sourceField === val);
                        updatePair(index, {
                          matchingSourceField: val || '',
                          matchingDestinationField: mapping?.destField || '',
                        });
                      }}
                      searchable
                      clearable
                    />
                  </Stack>
                </Collapse>
              </Box>
            ))}

            <Button
              variant="outline"
              leftSection={<Plus size={14} />}
              onClick={() => {
                setFolderPairs([...folderPairs, createPair()]);
              }}
            >
              Add Folder Pair
            </Button>
          </Stack>

          {/* Schedule */}
          <Select
            label="Schedule"
            placeholder="Select schedule"
            data={SCHEDULE_OPTIONS}
            value={schedule}
            onChange={(val) => {
              setSchedule(val || '');
            }}
            renderOption={renderScheduleOption}
          />

          {/* Options */}
          <Stack gap="xs">
            <Checkbox
              label="Auto-publish changes after sync"
              checked={autoPublish}
              onChange={(e) => {
                setAutoPublish(e.currentTarget.checked);
              }}
            />
            <Checkbox
              label="Validate Mappings"
              description="Check if source and destination field types are compatible"
              checked={enableValidation}
              onChange={(e) => {
                setEnableValidation(e.currentTarget.checked);
              }}
            />
          </Stack>
        </Stack>
      </ScrollArea>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Stack>
  );
}
