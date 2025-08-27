import { PrimaryButton, SecondaryButton } from '@/app/components/base/buttons';
import { DiffViewer } from '@/app/components/DiffViewer';
import { EnhancedTextArea } from '@/app/components/EnhancedTextArea';
import {
  getSafeBooleanValue,
  getSafeNumberValue,
  isLargeTextColumn,
  PostgresColumnType,
  SnapshotRecord,
  TableSpec,
} from '@/types/server-entities/snapshot';
import { ColumnView, isColumnHidden, isColumnProtected } from '@/types/server-entities/view';
import { Checkbox, Group, NumberInput, ScrollArea, Stack, Textarea, TextInput } from '@mantine/core';
import { ArrowUpIcon, XIcon } from '@phosphor-icons/react';
import styles from './DisplayField.module.css';
import { FieldLabel, FieldRow } from './FieldRow';

interface DisplayFieldProps {
  table: TableSpec;
  record: SnapshotRecord;
  columnId: string;
  mode: 'normal' | 'focus';
  align?: React.CSSProperties['alignItems'];
  currentView?: ColumnView;
  updateField: (columnId: string, value: string) => void;
  onFieldLabelClick: () => void;
  onAcceptSuggestion: () => void;
  onRejectSuggestion: () => void;
  saving: boolean;
}

export const DisplayField = (props: DisplayFieldProps) => {
  const {
    table,
    record,
    columnId,
    mode,
    align = 'flex-start',
    currentView,
    updateField,
    onFieldLabelClick,
    onAcceptSuggestion,
    onRejectSuggestion,
    saving,
  } = props;
  if (!record) return null;
  if (!table) return null;

  const column = table.columns.find((c) => c.id.wsId === columnId);
  if (!column) return null;

  const isHidden = currentView && isColumnHidden(table.id.wsId, columnId, currentView);
  const isProtected = currentView && isColumnProtected(table.id.wsId, columnId, currentView);
  const hasEditedValue = !!record.__edited_fields?.[columnId];
  const hasSuggestion = !!record.__suggested_values?.[columnId];
  const suggestValueColor = '#b8860b';
  const suggestValueBorderColor = '#e0e0e0';
  const suggestValueBackgroundColor = '#fefefe';

  const suggestionButtons = hasSuggestion ? (
    <Group gap="xs" justify="center">
      <SecondaryButton
        size="xs"
        color="red"
        leftSection={<XIcon size={14} />}
        onClick={onRejectSuggestion}
        loading={saving}
      >
        Reject
      </SecondaryButton>
      <PrimaryButton
        size="xs"
        color="green"
        leftSection={<ArrowUpIcon size={14} />}
        onClick={onAcceptSuggestion}
        loading={saving}
      >
        Accept
      </PrimaryButton>
    </Group>
  ) : null;

  if (column.pgType === PostgresColumnType.NUMERIC) {
    // this needs to be handled differently
    const currentValue = getSafeNumberValue(record.fields, columnId);
    const suggestedValue = record.__suggested_values?.[columnId] as string;

    const numberField = (
      <NumberInput
        key={columnId}
        value={currentValue}
        onChange={(value) => updateField(columnId, value.toString())}
        readOnly={column.readonly || hasSuggestion}
        hideControls
        styles={{
          input: {
            borderColor: 'transparent',
            fontSize: '1rem',
            padding: !hasSuggestion ? '0' : undefined,
          },
        }}
      />
    );

    return (
      <FieldRow
        fieldName={column.name}
        hasEditedValue={hasEditedValue}
        isProtected={isProtected}
        isHidden={isHidden}
        isReadOnly={column.readonly}
        align={align}
        onFieldLabelClick={onFieldLabelClick}
      >
        {hasSuggestion ? (
          <Stack h="auto" gap="xs" w="100%">
            <Group gap="xs" align="flex-start" grow>
              {numberField}
              <TextInput
                label="Suggested change"
                inputWrapperOrder={['input', 'label', 'description', 'error']}
                value={suggestedValue}
                disabled
                styles={{
                  input: {
                    fontSize: '1rem',
                    color: suggestValueColor,
                    backgroundColor: suggestValueBackgroundColor,
                    borderColor: suggestValueBorderColor,
                  },
                }}
              />
            </Group>
          </Stack>
        ) : (
          numberField
        )}
      </FieldRow>
    );
  }

  if (column.pgType === PostgresColumnType.BOOLEAN) {
    const currentValue = getSafeBooleanValue(record.fields, columnId);
    const suggestedValue = record.__suggested_values?.[columnId] as string;

    const booleanField = (
      <Checkbox
        key={columnId}
        checked={currentValue}
        onChange={(e) => updateField(columnId, e.target.checked.toString())}
        readOnly={column.readonly || hasSuggestion}
      />
    );

    return (
      <FieldRow
        fieldName={column.name}
        hasEditedValue={hasEditedValue}
        isProtected={isProtected}
        isHidden={isHidden}
        isReadOnly={column.readonly}
        align={align}
        onFieldLabelClick={onFieldLabelClick}
      >
        {hasSuggestion ? (
          <Stack h="auto" gap="xs" w="100%">
            <Group gap="xs" align="flex-start" grow>
              {booleanField}
              <TextInput
                label="Suggested change"
                inputWrapperOrder={['input', 'label', 'description', 'error']}
                value={suggestedValue}
                disabled
                styles={{
                  input: {
                    fontSize: '1rem',
                    color: suggestValueColor,
                    backgroundColor: suggestValueBackgroundColor,
                    borderColor: suggestValueBorderColor,
                  },
                }}
              />
            </Group>
            {suggestionButtons}
          </Stack>
        ) : (
          booleanField
        )}
      </FieldRow>
    );
  }

  const currentValue = record.fields[columnId] as string;
  const suggestedValue = record.__suggested_values?.[columnId] as string;

  if (isLargeTextColumn(column, currentValue)) {
    if (mode === 'normal') {
      return (
        <FieldRow
          fieldName={column.name}
          hasEditedValue={hasEditedValue}
          isProtected={isProtected}
          isHidden={isHidden}
          isReadOnly={column.readonly}
          align={align}
          onFieldLabelClick={onFieldLabelClick}
        >
          {hasSuggestion ? (
            <Stack h="auto" gap="xs" w="100%">
              <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
                <DiffViewer originalValue={currentValue} suggestedValue={suggestedValue} p="0" />
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
              minRows={!currentValue || currentValue.length < 200 ? 3 : 5}
              w="100%"
              resize="vertical"
              onChange={(e) => updateField(columnId, e.target.value)}
              readOnly={column.readonly || hasSuggestion}
              styles={{
                input: {
                  borderColor: 'transparent',
                  fontSize: '1rem',
                },
              }}
            />
          )}
        </FieldRow>
      );
    } else {
      return (
        <Stack align="flex-start" gap="xs" w="100%">
          <FieldLabel
            fieldName={column.name}
            hasEditedValue={hasEditedValue}
            isProtected={isProtected}
            onClick={onFieldLabelClick}
          />
          {hasSuggestion ? (
            <Stack h="auto" gap="xs" w="100%">
              <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
                <DiffViewer originalValue={currentValue} suggestedValue={suggestedValue} p="0" />
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
              minRows={10}
              w="100%"
              resize="vertical"
              onChange={(e) => updateField(columnId, e.target.value)}
              readOnly={column.readonly || hasSuggestion}
              styles={{
                input: {
                  borderColor: 'transparent',
                  fontSize: '1rem',
                  padding: 0,
                },
              }}
            />
          )}
        </Stack>
      );
    }
  }

  const textField = (
    <EnhancedTextArea
      flex={1}
      inputWrapperOrder={['input', 'label', 'description', 'error']}
      key={columnId}
      value={currentValue ?? ''}
      autosize
      minRows={1}
      resize="vertical"
      onChange={(e) => updateField(columnId, e.target.value)}
      readOnly={column.readonly || hasSuggestion}
      classNames={styles}
      styles={{
        input: {
          borderColor: 'transparent',
          fontSize: '1rem',
          padding: !hasSuggestion ? '0' : undefined,
        },
      }}
    />
  );

  return (
    <FieldRow
      fieldName={column.name}
      hasEditedValue={hasEditedValue}
      isProtected={isProtected}
      isHidden={isHidden}
      align={align}
      onFieldLabelClick={onFieldLabelClick}
    >
      {hasSuggestion ? (
        <Stack h="auto" gap="xs" w="100%">
          <Group gap="xs" align="flex-start" grow>
            {textField}
            <Textarea
              inputWrapperOrder={['input', 'label', 'description', 'error']}
              value={suggestedValue}
              disabled
              minRows={1}
              autosize
              styles={{
                input: {
                  fontSize: '1rem',
                  color: suggestValueColor,
                  backgroundColor: suggestValueBackgroundColor,
                  borderColor: suggestValueBorderColor,
                },
              }}
            />
          </Group>
          {suggestionButtons}
        </Stack>
      ) : (
        textField
      )}
    </FieldRow>
  );
};
