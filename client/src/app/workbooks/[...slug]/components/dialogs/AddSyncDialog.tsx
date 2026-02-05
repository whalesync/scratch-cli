import { Text13Medium } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useDataFolders } from '@/hooks/use-data-folders';
import { syncApi } from '@/lib/api/sync';
import { workbookApi } from '@/lib/api/workbook';
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Box,
  Button,
  Checkbox,
  Code,
  Collapse,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { Sync } from '@spinner/shared-types';
import { ArrowRight, Braces, ChevronDown, ChevronUp, Database, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AddSyncDialogProps {
  opened: boolean;
  onClose: () => void;
  onSyncCreated?: () => void;
  syncToEdit?: Sync;
}

type Step = 'configure-pairs' | 'name-and-schedule';

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

const SCHEDULE_OPTIONS = [
  { value: '', label: 'Manual only' },
  { value: '*/5 * * * *', label: 'Every 5 minutes' },
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 0 * * *', label: 'Daily at midnight' },
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

export const AddSyncDialog = ({ opened, onClose, onSyncCreated, syncToEdit }: AddSyncDialogProps) => {
  const { dataFolderGroups } = useDataFolders();
  const { workbook } = useActiveWorkbook();
  const [step, setStep] = useState<Step>('configure-pairs');
  const [folderPairs, setFolderPairs] = useState<FolderPair[]>([createPair()]);
  const [syncName, setSyncName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [autoPublish, setAutoPublish] = useState(true);
  const [enableValidation, setEnableValidation] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  const [saving, setSaving] = useState(false);
  const [schemaCache, setSchemaCache] = useState<Record<string, { path: string; type: string }[]>>({});

  // Fetch schema paths if not in cache
  const ensureSchemaPaths = async (folderId: string) => {
    if (!folderId || schemaCache[folderId]) return;

    const paths = await workbookApi.getSchemaPaths(folderId);
    setSchemaCache((prev) => ({ ...prev, [folderId]: paths }));
  };

  // Flatten folders for easy selection
  const allFolders = dataFolderGroups.flatMap((g) => g.dataFolders);

  // Reset or populate state when opening
  useEffect(() => {
    if (opened) {
      if (syncToEdit) {
        setStep('configure-pairs'); // Or maybe go straight to name? No, better review pairs.
        setSyncName(syncToEdit.displayName);
        setSchedule(''); // Schedule not in Sync type yet properly?
        // autoPublish not in Sync type yet?

        // Reconstruct pairs from syncTablePairs
        // SyncTablePair has sourceDataFolderId, destinationDataFolderId
        // We don't have field mappings in the DB model yet as per comments in service.
        // "Using an empty object for now as SyncMapping structure is complex... mappings: {}"
        // So we can only recover folder pairs, but field mappings are lost or stored in unstructured `mappings`.
        // If we assume `mappings` JSON column stores the config, we should use it.
        // Service code: "mappings: {},"
        // So we effectively lose field mappings on save currently?
        // Wait, current Create logic sends folderMappings with fieldMap.
        // Service saves it to... nowhere?
        // "mappings: {}" -> It seems we are NOT persisting field mappings in the backend yet?
        // If so, "Edit" is going to be lossy (will default to empty mappings).
        // Let's assume for this task we just reconstruct folder pairs with default empty mappings
        // OR warn user that we can't fully edit mappings yet.
        // User said: "prepopualte it with the current data."
        // If data isn't saved, we can't prepopulate.
        // Let's check Sync type in backend to see if we missed where it's saved.
        // Backend `sync.service.ts`: "Using an empty object for now... mappings: {}"
        // CAUTION: We can't actually edit field mappings if they aren't saved.
        // But for folder pairs we can.

        if (syncToEdit.mappings && syncToEdit.mappings.tableMappings) {
          const uniqueFolderIds = new Set<string>();
          const pairs: FolderPair[] = syncToEdit.mappings.tableMappings.map((tm) => {
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
        } else if (syncToEdit.syncTablePairs) {
          // Fallback to table pairs if mappings are empty (legacy or migration)
          const pairs: FolderPair[] = syncToEdit.syncTablePairs.map((p) => ({
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
      } else {
        setStep('configure-pairs');
        setFolderPairs([createPair()]);
        setSyncName('');
        setSchedule('');
        setAutoPublish(true);
        setEnableValidation(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, syncToEdit]);

  // Auto-generate name
  useEffect(() => {
    if (step === 'name-and-schedule' && !syncName) {
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
  }, [step, folderPairs, allFolders, syncName]);

  const handleCreate = async () => {
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

      if (!workbook?.id) {
        throw new Error('No active workbook');
      }

      if (syncToEdit) {
        await syncApi.update(workbook.id, syncToEdit.id, payload);
      } else {
        await syncApi.create(workbook.id, payload);
      }

      onSyncCreated?.();
      onClose();
    } catch (error) {
      console.error('Error creating sync:', error);
      // TODO: Show toast notification
    } finally {
      setSaving(false);
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

  const validPairsCount = folderPairs.filter((p) => {
    const hasValidMappings = p.fieldMappings.some((m) => m.sourceField && m.destField);
    return p.sourceId && p.destId && hasValidMappings;
  }).length;

  // -- Render Steps -- //

  const renderConfigurePairs = () => (
    <Stack>
      {folderPairs.map((pair, index) => (
        <Box
          key={pair.id}
          style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-md)' }}
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
                  data={allFolders.filter((f) => f.id !== pair.destId).map((f) => ({ value: f.id, label: f.name }))}
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
                  data={allFolders.filter((f) => f.id !== pair.sourceId).map((f) => ({ value: f.id, label: f.name }))}
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
                label="Matching Field (Optional)"
                description="Select the field mapping to use for matching records (e.g. ID to External ID)"
                placeholder="Select matching pair"
                data={pair.fieldMappings
                  .filter((m) => m.sourceField && m.destField)
                  .map((m) => ({
                    value: m.sourceField, // distinct by source field? Need unique pairs?
                    // Actually we want to select "Source -> Dest" pair.
                    // But Select works on single value.
                    // Let's use sourceField as value, and hope it's unique enough or find corresponding dest.
                    // Ideally we should probably store index or ID of mapping?
                    // But mappings in UI are ephemeral.
                    // Let's just use JSON string needed? No, ugly.
                    // If we assume a source field maps to only one dest field in a valid sync...
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
        onClick={() => setFolderPairs([...folderPairs, createPair()])}
      >
        Add Folder Pair
      </Button>
    </Stack>
  );

  const renderNameAndSchedule = () => (
    <Stack>
      <TextInput
        label="Sync Name"
        placeholder="My Sync"
        value={syncName}
        onChange={(e) => setSyncName(e.currentTarget.value)}
      />
      <Select
        label="Schedule"
        placeholder="Select schedule"
        data={SCHEDULE_OPTIONS}
        value={schedule}
        onChange={(val) => setSchedule(val || '')}
      />

      <Checkbox
        label="Auto-publish changes after sync"
        checked={autoPublish}
        onChange={(e) => setAutoPublish(e.currentTarget.checked)}
      />
      <Checkbox
        label="Validate Mappings"
        description="Check if source and destination field types are compatible"
        checked={enableValidation}
        onChange={(e) => setEnableValidation(e.currentTarget.checked)}
      />
    </Stack>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text>
            {step === 'configure-pairs'
              ? syncToEdit
                ? 'Edit Sync - Configure Pairs'
                : 'Configure Folder Pairs'
              : syncToEdit
                ? 'Edit Sync - Name & Schedule'
                : 'Name & Schedule'}
          </Text>
          <Tooltip label="Show Debug JSON">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setShowDebug(!showDebug)}>
              <Braces size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      }
      size="lg"
    >
      {showDebug && (
        <Box mb="md">
          <Text size="xs" fw={700} mb={4}>
            Debug State:
          </Text>
          <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(
              {
                syncName,
                schedule,
                autoPublish,
                enableValidation,
                folderPairs,
              },
              null,
              2,
            )}
          </Code>
        </Box>
      )}

      <ScrollArea.Autosize mah={600} style={{ overflowX: 'hidden' }}>
        {step === 'configure-pairs' ? renderConfigurePairs() : renderNameAndSchedule()}
      </ScrollArea.Autosize>

      <Group justify="right" mt="xl">
        {step === 'configure-pairs' ? (
          <>
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setStep('name-and-schedule')} disabled={validPairsCount === 0}>
              Next
            </Button>
          </>
        ) : (
          <>
            <Button variant="default" onClick={() => setStep('configure-pairs')}>
              Back
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              {syncToEdit ? 'Save Changes' : 'Create Sync'}
            </Button>
          </>
        )}
      </Group>
    </Modal>
  );
};
