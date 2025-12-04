import { Text13Regular } from '@/app/components/base/text';
import { DiffViewer } from '@/app/components/DiffViewer';
import { EnhancedTextArea, TextAreaRef } from '@/app/components/EnhancedTextArea';
import { ExistingChangeTypes } from '@/app/components/field-value-wrappers/ProcessedFieldValue';
import { InlineSuggestionButtons } from '@/app/components/field-value-wrappers/SuggestionButtons';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import {
  formatFieldValue,
  getSafeBooleanValue,
  getSafeNumberValue,
  isLargeTextColumn,
  isUrlColumn,
  PostgresColumnType,
  TableSpec,
} from '@/types/server-entities/workbook';
import { Anchor, Checkbox, NumberInput, ScrollArea, Stack } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { diffWordsWithSpace } from 'diff';
import { RefObject } from 'react';
import styles from './DisplayField.module.css';
import { FieldRow } from './FieldRow';

interface DisplayFieldProps {
  table: TableSpec;
  record: ProcessedSnapshotRecord;
  columnId: string;
  mode: 'multiple' | 'single';
  align?: React.CSSProperties['alignItems'];
  updateField: (columnId: string, value: string | number | boolean) => void;
  onFieldLabelClick: () => void;
  onAcceptSuggestion: () => void;
  onRejectSuggestion: () => void;
  saving: boolean;
  focusTargetRef?: RefObject<TextAreaRef | null>;
}

export const DisplayField = (props: DisplayFieldProps) => {
  const {
    table,
    record,
    columnId,
    mode,
    updateField,
    onFieldLabelClick,
    onAcceptSuggestion,
    onRejectSuggestion,
    saving,
    focusTargetRef /** place on an element that wants to get focus when user hits enter */,
  } = props;

  // Early validation
  if (!record) return null;
  if (!table) return null;

  const column = table.columns.find((c) => c.id.wsId === columnId);
  if (!column) return null;

  const hasEditedValue = !!record.__edited_fields?.[columnId];
  const hasSuggestion = !!record.__suggested_values?.[columnId];
  const processedFieldValue = record.__processed_fields[columnId];

  // Calculate aggregate changes for the entire record (similar to IdValueWrapper)
  const recordChangeTypes: ExistingChangeTypes = {};
  if (record.__suggested_values) {
    Object.entries(record.__suggested_values).forEach(([fieldId, suggestedValue]) => {
      const currentValue = record.fields?.[fieldId];
      const changes = diffWordsWithSpace(String(currentValue ?? ''), String(suggestedValue ?? ''));
      if (changes.some((c) => c.added)) recordChangeTypes.suggestedAdditions = true;
      if (changes.some((c) => c.removed)) recordChangeTypes.suggestedDeletions = true;
    });
  }
  if (record.__edited_fields && Object.keys(record.__edited_fields).length > 0) {
    recordChangeTypes.acceptedAdditions = true;
    recordChangeTypes.acceptedDeletions = true;
  }

  const suggestionButtons = hasSuggestion ? (
    <InlineSuggestionButtons onAcceptClick={onAcceptSuggestion} onRejectClick={onRejectSuggestion} disabled={saving} />
  ) : null;

  if (column.pgType === PostgresColumnType.NUMERIC) {
    // this needs to be handled differently
    const currentValue = getSafeNumberValue(record.fields, columnId);
    const currentValueString = currentValue?.toString() ?? '';
    const suggestedValue = record.__suggested_values?.[columnId];
    const suggestedValueString = suggestedValue?.toString() ?? '';

    const numberInputField = (
      <NumberInput
        key={columnId}
        value={currentValue}
        onChange={(value) => updateField(columnId, typeof value === 'number' ? value : value.toString())}
        readOnly={column.readonly || hasSuggestion}
        hideControls
        styles={{
          input: {
            borderColor: 'transparent',
            fontSize: '1rem',
          },
        }}
      />
    );
    return (
      <FieldRow
        fieldName={column.name}
        showLabel={mode === 'multiple'}
        hasEditedValue={hasEditedValue}
        isReadOnly={column.readonly}
        onLabelClick={onFieldLabelClick}
        changeTypes={processedFieldValue.existingChangeTypes}
        recordChangeTypes={recordChangeTypes}
      >
        {hasSuggestion ? (
          <Stack h="auto" gap="xs" w="100%">
            <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
              <DiffViewer originalValue={currentValueString} suggestedValue={suggestedValueString} />
            </ScrollArea>
            {mode === 'multiple' && suggestionButtons}
          </Stack>
        ) : mode === 'multiple' ? (
          <Text13Regular>{currentValueString}</Text13Regular>
        ) : (
          numberInputField
        )}
      </FieldRow>
    );
  }

  if (column.pgType === PostgresColumnType.TIMESTAMP) {
    // this needs to be handled differently
    const currentValue = record.fields[columnId] ? new Date(record.fields[columnId] as Date | string) : null;
    const currentValueString = currentValue ? currentValue.toLocaleString() : '';
    const suggestedValue = record.__suggested_values?.[columnId]
      ? new Date(record.__suggested_values?.[columnId] as string)
      : null;
    const suggestedValueString = suggestedValue ? suggestedValue.toLocaleString() : '';

    const dateInputField = (
      <DateTimePicker
        key={columnId}
        value={currentValue}
        onChange={(value) => updateField(columnId, value ?? '')}
        readOnly={column.readonly || hasSuggestion}
        styles={{
          input: {
            borderColor: 'transparent',
            fontSize: '1rem',
          },
        }}
      />
    );
    return (
      <FieldRow
        fieldName={column.name}
        showLabel={mode === 'multiple'}
        hasEditedValue={hasEditedValue}
        isReadOnly={column.readonly}
        onLabelClick={onFieldLabelClick}
        changeTypes={processedFieldValue.existingChangeTypes}
        recordChangeTypes={recordChangeTypes}
      >
        {hasSuggestion ? (
          <Stack h="auto" gap="xs" w="100%">
            <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
              <DiffViewer originalValue={currentValueString} suggestedValue={suggestedValueString} />
            </ScrollArea>
            {mode === 'multiple' && suggestionButtons}
          </Stack>
        ) : mode === 'multiple' ? (
          <Text13Regular>{currentValueString}</Text13Regular>
        ) : (
          dateInputField
        )}
      </FieldRow>
    );
  }

  if (column.pgType === PostgresColumnType.BOOLEAN) {
    const currentValue = getSafeBooleanValue(record.fields, columnId);
    const suggestedValue = record.__suggested_values?.[columnId];

    const isReadOnly = column.readonly || hasSuggestion || mode === 'multiple';
    // Use this approach as the style is better for UX, using disabled prop would be worse for UX
    const booleanField = (
      <Checkbox
        key={columnId}
        label={mode === 'single' ? column.name : undefined}
        checked={currentValue}
        onChange={(e) => {
          if (!isReadOnly) {
            updateField(columnId, e.target.checked);
          }
        }}
        readOnly={isReadOnly}
        styles={{
          input: {
            cursor: isReadOnly ? 'not-allowed' : 'pointer',
          },
        }}
      />
    );

    return (
      <FieldRow
        fieldName={column.name}
        showLabel={mode === 'multiple'}
        hasEditedValue={hasEditedValue}
        isReadOnly={column.readonly}
        onLabelClick={onFieldLabelClick}
        changeTypes={processedFieldValue.existingChangeTypes}
        recordChangeTypes={recordChangeTypes}
      >
        {hasSuggestion ? (
          <Stack h="auto" gap="xs" w="100%">
            <DiffViewer
              originalValue={currentValue?.toString() ?? ''}
              suggestedValue={suggestedValue?.toString() ?? ''}
            />
            {suggestionButtons}
          </Stack>
        ) : (
          booleanField
        )}
      </FieldRow>
    );
  }

  const currentValue = formatFieldValue(record.fields[columnId], column);
  const suggestedValue = record.__suggested_values?.[columnId] as string;

  if (isLargeTextColumn(column, currentValue)) {
    if (mode === 'multiple') {
      return (
        <FieldRow
          fieldName={column.name}
          hasEditedValue={hasEditedValue}
          isReadOnly={column.readonly}
          onLabelClick={onFieldLabelClick}
          changeTypes={processedFieldValue.existingChangeTypes}
          recordChangeTypes={recordChangeTypes}
        >
          {hasSuggestion ? (
            <Stack h="auto" gap="xs" w="100%">
              <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
                <DiffViewer originalValue={currentValue} suggestedValue={suggestedValue} />
              </ScrollArea>
              {suggestionButtons}
            </Stack>
          ) : (
            <EnhancedTextArea
              flex={1}
              inputWrapperOrder={['input', 'label', 'description', 'error']}
              key={columnId}
              value={currentValue ?? ''}
              autosize
              minRows={!currentValue || currentValue.length < 200 ? 1 : 5}
              w="100%"
              resize="vertical"
              onChange={(e) => updateField(columnId, e.target.value)}
              readOnly={true}
            />
          )}
        </FieldRow>
      );
    } else {
      return (
        <Stack align="flex-start" gap="xs" w="100%">
          {hasSuggestion ? (
            <Stack h="auto" gap="xs" w="100%">
              <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
                <DiffViewer originalValue={currentValue} suggestedValue={suggestedValue} />
              </ScrollArea>
              {suggestionButtons}
            </Stack>
          ) : (
            <EnhancedTextArea
              ref={focusTargetRef}
              flex={1}
              inputWrapperOrder={['input', 'label', 'description', 'error']}
              key={columnId}
              value={currentValue ?? ''}
              autosize
              minRows={10}
              w="100%"
              resize="vertical"
              onChange={(e) => updateField(columnId, e.target.value)}
              readOnly={column.readonly || hasSuggestion}
            />
          )}
        </Stack>
      );
    }
  }

  const textInputField = (
    <EnhancedTextArea
      ref={focusTargetRef}
      flex={1}
      inputWrapperOrder={['input', 'label', 'description', 'error']}
      key={columnId}
      value={currentValue ?? ''}
      autosize
      minRows={1}
      resize="vertical"
      onChange={(e) => updateField(columnId, e.target.value)}
      readOnly={column.readonly || hasSuggestion}
    />
  );

  const displayField =
    mode === 'multiple' && isUrlColumn(column, currentValue) ? (
      <Anchor className={styles.recordValueDisplay} href={currentValue} target="_blank">
        {currentValue}
      </Anchor>
    ) : mode === 'multiple' ? (
      <Text13Regular>{currentValue}</Text13Regular>
    ) : (
      textInputField
    );

  return (
    <FieldRow
      fieldName={column.name}
      isReadOnly={column.readonly}
      showLabel={mode === 'multiple'}
      hasEditedValue={hasEditedValue}
      onLabelClick={onFieldLabelClick}
      changeTypes={processedFieldValue.existingChangeTypes}
      recordChangeTypes={recordChangeTypes}
    >
      {hasSuggestion ? (
        <Stack h="auto" gap="xs" w="100%">
          <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
            <DiffViewer originalValue={currentValue} suggestedValue={suggestedValue} />
          </ScrollArea>
          {suggestionButtons}
        </Stack>
      ) : (
        displayField
      )}
    </FieldRow>
  );
};
