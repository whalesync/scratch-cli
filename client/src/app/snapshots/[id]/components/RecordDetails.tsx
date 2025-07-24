/* eslint-disable @typescript-eslint/no-unused-vars */
import { DiffViewer } from '@/app/components/DiffViewer';
import { CursorPosition, EnhancedTextArea, TextSelection } from '@/app/components/EnhancedTextArea';
import { BulkUpdateRecordsDto, RecordOperation } from '@/types/server-entities/records';
import { ColumnSpec, PostgresColumnType, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import {
  ActionIcon,
  Button,
  Checkbox,
  CheckIcon,
  CopyButton,
  Divider,
  Group,
  Loader,
  NumberInput,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowUpIcon, CopyIcon, XIcon } from '@phosphor-icons/react';
import _ from 'lodash';
import { useCallback, useState } from 'react';
import { useAIPromptContext } from '../AIPromptContext';

interface RecordDetailsProps {
  snapshotId: string;
  currentRecord: SnapshotRecord;
  table: TableSpec;
  currentColumnId: string | undefined;
  acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  bulkUpdateRecord: (dto: BulkUpdateRecordsDto) => Promise<void>;
}

export const RecordDetails = ({
  currentRecord,
  table,
  currentColumnId,
  acceptCellValues,
  rejectCellValues,
  bulkUpdateRecord,
}: RecordDetailsProps) => {
  const [showSuggestedOnly, setShowSuggestedOnly] = useState(false);
  const [showEditedOnly, setShowEditedOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentTextSelection, setCurrentTextSelection] = useState<TextSelection | undefined>(undefined);
  const [currentCursorPosition, setCurrentCursorPosition] = useState<CursorPosition | undefined>(undefined);
  const { addToPrompt } = useAIPromptContext();

  const currentColumn = table.columns.find((c) => c.id.wsId === currentColumnId);

  const handleTextSelectionChange = useCallback(
    (selection: TextSelection) => {
      setCurrentTextSelection(selection);
      // console.debug('RecordDetails: text selection changed', selection);
    },
    [setCurrentTextSelection],
  );

  const handleTextAreaCursorChange = useCallback((cursor: CursorPosition) => {
    setCurrentCursorPosition(cursor);
    // console.debug('RecordDetails: cursor position changed', cursor);
  }, []);

  const updateField = useCallback(
    async (field: string, value: string) => {
      if (!currentRecord) return;

      const ops: RecordOperation[] = [
        {
          op: 'update',
          wsId: currentRecord.id.wsId,
          data: { [field]: value },
        },
      ];

      try {
        setSaving(true);
        await bulkUpdateRecord({ ops });
      } catch (e) {
        const error = e as Error;
        notifications.show({
          title: 'Error updating field',
          message: error.message,
          color: 'red',
        });
      } finally {
        setSaving(false);
      }
    },
    [currentRecord, bulkUpdateRecord],
  );

  const fieldToInput = useCallback(
    (
      record: SnapshotRecord,
      field: string,
      table: TableSpec,
      focusedView?: boolean,
      hasEditedValue?: boolean,
      hasSuggestion?: boolean,
    ) => {
      const column = table.columns.find((c) => c.id.wsId === field);
      if (!column) return null;
      if (!record) return null;

      const value = record.fields[field] as string;
      const greenBackgroundStyle = hasEditedValue
        ? {
            input: {
              backgroundColor: '#e0fde0',
            },
          }
        : undefined;

      if (isBigTextField(column, value)) {
        if (focusedView && !hasSuggestion) {
          // the text area should try and fill the full height of the parent stack
          return (
            <>
              <EnhancedTextArea
                key={field}
                label={column.name}
                value={value || ''}
                onChange={(e) => {
                  updateField(field, e.target.value);
                }}
                minRows={10}
                resize="vertical"
                styles={{
                  wrapper: {
                    height: '95%',
                  },
                  input: {
                    height: '95%',
                    ...greenBackgroundStyle?.input,
                  },
                }}
                h="95%"
                onSelectionChange={handleTextSelectionChange}
                onCursorChange={handleTextAreaCursorChange}
              />
            </>
          );
        } else {
          return (
            <>
              <EnhancedTextArea
                key={field}
                label={column.name}
                value={value || ''}
                onChange={(e) => updateField(field, e.target.value)}
                autosize
                minRows={3}
                maxRows={10}
                resize="vertical"
                readOnly={column.readonly || hasSuggestion}
                styles={greenBackgroundStyle}
                onSelectionChange={handleTextSelectionChange}
                onCursorChange={handleTextAreaCursorChange}
              />
            </>
          );
        }
      }

      if (column.pgType === PostgresColumnType.NUMERIC) {
        // this needs to be handled differently
        return (
          <NumberInput
            key={field}
            label={column.name}
            value={currentRecord.fields[field] as number}
            onChange={(value) => updateField(field, value.toString())}
            readOnly={column.readonly || hasSuggestion}
            styles={greenBackgroundStyle}
          />
        );
      }
      if (column.pgType === PostgresColumnType.BOOLEAN) {
        return (
          <Checkbox
            key={field}
            label={column.name}
            checked={value === 'true'}
            onChange={(e) => updateField(field, e.target.checked.toString())}
            readOnly={column.readonly || hasSuggestion}
          />
        );
      }

      if (
        column.pgType === PostgresColumnType.TEXT_ARRAY ||
        column.pgType === PostgresColumnType.NUMERIC_ARRAY ||
        column.pgType === PostgresColumnType.BOOLEAN_ARRAY
      ) {
        return (
          <>
            <EnhancedTextArea
              key={field}
              label={column.name}
              value={value ?? ''}
              autosize
              minRows={3}
              maxRows={10}
              onChange={(e) => updateField(field, e.target.value)}
              readOnly={column.readonly || hasSuggestion}
              styles={greenBackgroundStyle}
              resize="vertical"
              onSelectionChange={handleTextSelectionChange}
              onCursorChange={handleTextAreaCursorChange}
            />
          </>
        );
      }

      return (
        <TextInput
          key={field}
          label={column.name}
          value={value ?? ''}
          onChange={(e) => updateField(field, e.target.value)}
          readOnly={column.readonly || hasSuggestion}
          styles={greenBackgroundStyle}
        />
      );
    },
    [currentRecord, updateField],
  );

  let content = null;

  const fieldToInputAndSuggestion = useCallback(
    (field: string, table: TableSpec, focusedView?: boolean) => {
      const column = table.columns.find((c) => c.id.wsId === field);
      if (!column) return null;
      if (!currentRecord) return null;

      const hasSuggestion = !!currentRecord.__suggested_values?.[field];

      const handleAcceptSuggestion = async () => {
        if (!currentRecord) return;

        try {
          setSaving(true);
          await acceptCellValues([{ wsId: currentRecord.id.wsId, columnId: field }]);
          notifications.show({
            title: 'Suggestion Accepted',
            message: `Accepted suggestion for ${column.name}`,
            color: 'green',
          });
          // Refresh the records to get updated state
          // window.location.reload();
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error accepting suggestion',
            message: error.message,
            color: 'red',
          });
        } finally {
          setSaving(false);
        }
      };

      const handleRejectSuggestion = async () => {
        if (!currentRecord) return;

        try {
          setSaving(true);
          await rejectCellValues([{ wsId: currentRecord.id.wsId, columnId: field }]);

          notifications.show({
            title: 'Suggestion Rejected',
            message: `Rejected suggestion for ${column.name}`,
            color: 'green',
          });
          // Refresh the records to get updated state
          // window.location.reload();
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: 'Error rejecting suggestion',
            message: error.message,
            color: 'red',
          });
        } finally {
          setSaving(false);
        }
      };

      const hasEditedValue = !!currentRecord.__edited_fields?.[field];
      const currentValue = currentRecord.fields[field] as string;

      const suggestionButtons = hasSuggestion ? (
        <Group gap="xs" justify="center">
          <Button
            size="xs"
            variant="outline"
            color="red"
            leftSection={<XIcon size={14} />}
            onClick={handleRejectSuggestion}
            loading={saving}
          >
            Reject
          </Button>
          <Button
            size="xs"
            variant="filled"
            color="green"
            leftSection={<ArrowUpIcon size={14} />}
            onClick={handleAcceptSuggestion}
            loading={saving}
          >
            Accept
          </Button>
        </Group>
      ) : null;

      if (hasSuggestion && isBigTextField(column, currentValue)) {
        return (
          <Stack h={focusedView ? '100%' : 'auto'} key={field} gap="2px">
            <Text size="sm" fw={500}>
              {column.name}
            </Text>
            <ScrollArea mah="80%" w="100%" type="hover" styles={{ root: { border: '1px solid #e0e0e0' } }} mb="xs">
              <DiffViewer
                originalValue={currentValue}
                suggestedValue={currentRecord.__suggested_values?.[field] as string}
              />
            </ScrollArea>
            {suggestionButtons}
          </Stack>
        );
      } else if (hasSuggestion) {
        return (
          <Stack key={field} gap="xs" h={focusedView ? '100%' : undefined}>
            <Group gap="xs" align="flex-end" grow>
              {fieldToInput(currentRecord, field, table, focusedView, hasEditedValue, hasSuggestion)}
              <Textarea
                label="Suggested change"
                value={currentRecord.__suggested_values?.[field] as string}
                disabled
                autosize
                minRows={1}
                maxRows={10}
                styles={{
                  input: {
                    color: '#b8860b',
                    backgroundColor: '#fefefe',
                    borderColor: '#e0e0e0',
                  },
                }}
              />
            </Group>
            {suggestionButtons}
          </Stack>
        );
      }

      return (
        <Stack key={field} gap="xs" h={focusedView ? '100%' : undefined}>
          {fieldToInput(currentRecord, field, table, focusedView, hasEditedValue, hasSuggestion)}
        </Stack>
      );
    },
    [currentRecord, fieldToInput, saving, acceptCellValues, rejectCellValues],
  );

  if (currentRecord && currentColumn) {
    // just show the current active column
    content = fieldToInputAndSuggestion(currentColumn.id.wsId, table, true);
  } else if (currentRecord) {
    // Filter fields based on checkbox states
    const fieldsToShow = Object.keys(currentRecord.fields).filter((fieldName) => {
      const hasSuggestion = currentRecord.__suggested_values?.[fieldName] !== undefined;
      const hasEditedValue = currentRecord.__edited_fields?.[fieldName] !== undefined;

      if (showSuggestedOnly && showEditedOnly) {
        // Both checkboxes checked: show fields that have BOTH suggestion AND edited value
        return hasSuggestion && hasEditedValue;
      } else if (showSuggestedOnly) {
        // Only suggested checkbox checked: show fields with suggestions
        return hasSuggestion;
      } else if (showEditedOnly) {
        // Only edited checkbox checked: show fields with edited values
        return hasEditedValue;
      } else {
        // No checkboxes checked: show all fields
        return true;
      }
    });

    content = <>{fieldsToShow.map((fieldName) => fieldToInputAndSuggestion(fieldName, table, false))}</>;
  }

  return (
    <Stack h="100%">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <Text>Record Details</Text>
          <CopyButton value={currentRecord.id.wsId} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : 'Copy record ID'} withArrow position="right">
                <ActionIcon color={copied ? 'teal' : 'gray'} variant="subtle" onClick={copy}>
                  {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
          {saving && (
            <Group gap="3px" ml="auto">
              <Loader size="xs" />
              <Text size="xs" c="dimmed">
                Saving...
              </Text>
            </Group>
          )}
        </Group>
        <Group gap="md">
          {!currentColumn && (
            <>
              <Checkbox
                label="Show fields with suggested changes only"
                checked={showSuggestedOnly}
                onChange={(e) => setShowSuggestedOnly(e.target.checked)}
              />
              <Checkbox
                label="Show fields with updated values only"
                checked={showEditedOnly}
                onChange={(e) => setShowEditedOnly(e.target.checked)}
              />
            </>
          )}
        </Group>
      </Group>
      {content}
      {currentTextSelection && currentTextSelection.text.length > 0 ? (
        <>
          <Divider />
          <Group gap="md">
            <Button variant="outline" onClick={() => addToPrompt(currentTextSelection?.text)}>
              Add to prompt
            </Button>
          </Group>
        </>
      ) : null}
    </Stack>
  );
};

function isBigTextField(column: ColumnSpec, value: string | undefined | null) {
  return (
    column.markdown ||
    column.pgType === PostgresColumnType.JSONB ||
    (column.pgType === PostgresColumnType.TEXT && value && _.isString(value) && value.length > 200)
  );
}
