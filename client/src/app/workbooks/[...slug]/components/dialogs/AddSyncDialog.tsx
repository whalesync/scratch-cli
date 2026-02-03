import { Text13Medium } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useDataFolders } from '@/hooks/use-data-folders';
import { syncApi } from '@/lib/api/sync';
import {
  ActionIcon,
  Box,
  Button,
  Checkbox,
  Collapse,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { ArrowRight, ChevronDown, ChevronUp, Database, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AddSyncDialogProps {
  opened: boolean;
  onClose: () => void;
  onSyncCreated?: () => void;
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
  matchingField: string;
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
  matchingField: '',
  expanded: true,
});

const SCHEDULE_OPTIONS = [
  { value: '', label: 'Manual only' },
  { value: '*/5 * * * *', label: 'Every 5 minutes' },
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 0 * * *', label: 'Daily at midnight' },
];

export function AddSyncDialog({ opened, onClose, onSyncCreated }: AddSyncDialogProps) {
  const { dataFolderGroups } = useDataFolders();
  const { workbook } = useActiveWorkbook();
  const [step, setStep] = useState<Step>('configure-pairs');
  const [folderPairs, setFolderPairs] = useState<FolderPair[]>([createPair()]);
  const [syncName, setSyncName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [autoPublish, setAutoPublish] = useState(true);
  const [saving, setSaving] = useState(false);

  // Flatten folders for easy selection
  const allFolders = dataFolderGroups.flatMap((g) => g.dataFolders);

  // Reset state when opening
  useEffect(() => {
    if (opened) {
      setStep('configure-pairs');
      setFolderPairs([createPair()]);
      setSyncName('');
      setSchedule('');
      setAutoPublish(true);
    }
  }, [opened]);

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
          matchingField: pair.matchingField || null,
        };
      });

      const payload = {
        name: syncName || 'Untitled Sync',
        folderMappings,
        // Schedule and autoPublish are ignored by backend for now but sent anyway
        schedule: schedule || null,
        autoPublish,
      };

      if (!workbook?.id) {
        throw new Error('No active workbook');
      }

      await syncApi.create(workbook.id, payload);

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
                  onChange={(val) => updatePair(index, { sourceId: val || '' })}
                  searchable
                />
                <Select
                  label="Destination Folder"
                  placeholder="Select destination"
                  data={allFolders.filter((f) => f.id !== pair.sourceId).map((f) => ({ value: f.id, label: f.name }))}
                  value={pair.destId}
                  onChange={(val) => updatePair(index, { destId: val || '' })}
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
                    <TextInput
                      placeholder="Source field"
                      style={{ flex: 1 }}
                      value={mapping.sourceField}
                      onChange={(e) => updateFieldMapping(index, mIndex, 'sourceField', e.currentTarget.value)}
                    />
                    <ArrowRight size={14} color="var(--mantine-color-dimmed)" />
                    <TextInput
                      placeholder="Dest field"
                      style={{ flex: 1 }}
                      value={mapping.destField}
                      onChange={(e) => updateFieldMapping(index, mIndex, 'destField', e.currentTarget.value)}
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

              <TextInput
                label="Matching Field (Optional)"
                description="Field on destination that stores the source record ID"
                placeholder="e.g. source_id"
                value={pair.matchingField}
                onChange={(e) => updatePair(index, { matchingField: e.currentTarget.value })}
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
    </Stack>
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={step === 'configure-pairs' ? 'Configure Folder Pairs' : 'Name & Schedule'}
      size="lg"
    >
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
              Create Sync
            </Button>
          </>
        )}
      </Group>
    </Modal>
  );
}
