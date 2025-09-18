import { AcceptSuggestionButton, RejectSuggestionButton } from '@/app/components/base/buttons';
import { DiffViewer } from '@/app/components/DiffViewer';
import { EnhancedTextArea } from '@/app/components/EnhancedTextArea';
import {
  formatFieldValue,
  getSafeBooleanValue,
  getSafeNumberValue,
  isLargeTextColumn,
  PostgresColumnType,
  SnapshotRecord,
  TableSpec,
} from '@/types/server-entities/snapshot';
import { ColumnView, isColumnHidden, isColumnProtected } from '@/types/server-entities/view';
import { Checkbox, Group, NumberInput, ScrollArea, Stack } from '@mantine/core';
import { CircleArrowRightIcon } from 'lucide-react';
import styles from './DisplayField.module.css';
import { FieldRow } from './FieldRow';

interface DisplayFieldProps {
  table: TableSpec;
  record: SnapshotRecord;
  columnId: string;
  mode: 'multiple' | 'single';
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
  const suggestValueColor = '#284283';
  // const suggestValueBorderColor = '#e0e0e0';
  // const suggestValueBackgroundColor = '#fefefe';

  const suggestionButtons = hasSuggestion ? (
    <Group gap="xs" justify="flex-end">
      <RejectSuggestionButton onClick={onRejectSuggestion} loading={saving}>
        Reject
      </RejectSuggestionButton>
      <AcceptSuggestionButton onClick={onAcceptSuggestion} loading={saving}>
        Accept
      </AcceptSuggestionButton>
    </Group>
  ) : null;

  const basicFieldPadding = !hasSuggestion ? (mode === 'multiple' ? '0' : '3rem') : undefined;

  if (column.pgType === PostgresColumnType.NUMERIC) {
    // this needs to be handled differently
    const currentValue = getSafeNumberValue(record.fields, columnId);
    const currentValueString = currentValue?.toString() ?? '';
    const suggestedValue = record.__suggested_values?.[columnId];
    const suggestedValueString = suggestedValue?.toString() ?? '';

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
            padding: basicFieldPadding,
          },
        }}
      />
    );

    return (
      <FieldRow
        fieldName={column.name}
        showLabel={mode === 'multiple'}
        hasEditedValue={hasEditedValue}
        isProtected={isProtected}
        isHidden={isHidden}
        isReadOnly={column.readonly}
        align={align}
        onLabelClick={onFieldLabelClick}
      >
        {hasSuggestion ? (
          <Stack h="auto" gap="xs" w="100%">
            <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
              <DiffViewer
                originalValue={currentValueString}
                suggestedValue={suggestedValueString}
                p={mode === 'multiple' ? '0' : '3rem'}
                splitMinRows={1}
              />
            </ScrollArea>
            {mode === 'multiple' && suggestionButtons}
          </Stack>
        ) : (
          numberField
        )}
      </FieldRow>
    );
  }

  if (column.pgType === PostgresColumnType.BOOLEAN) {
    const currentValue = getSafeBooleanValue(record.fields, columnId);
    const suggestedValue = record.__suggested_values?.[columnId];
    const suggestedValueString = suggestedValue?.toString() ?? '';

    const booleanField = (
      <Checkbox
        key={columnId}
        label={mode === 'single' ? column.name : undefined}
        checked={currentValue}
        onChange={(e) => updateField(columnId, e.target.checked.toString())}
        readOnly={column.readonly || hasSuggestion}
        p={basicFieldPadding}
      />
    );

    return (
      <FieldRow
        fieldName={column.name}
        showLabel={mode === 'multiple'}
        hasEditedValue={hasEditedValue}
        isProtected={isProtected}
        isHidden={isHidden}
        isReadOnly={column.readonly}
        align={align}
        onLabelClick={onFieldLabelClick}
      >
        {hasSuggestion ? (
          <Stack h="auto" gap="xs" w="100%">
            <Group gap="xs" align="flex-start">
              {booleanField}
              <CircleArrowRightIcon color={suggestValueColor} />
              <Checkbox
                key={`${columnId}-suggested`}
                label={mode === 'single' ? column.name : undefined}
                checked={suggestedValueString === 'true'}
                readOnly={true}
                c={suggestValueColor}
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

  const currentValue = formatFieldValue(record.fields[columnId], column);
  const suggestedValue = record.__suggested_values?.[columnId] as string;

  if (isLargeTextColumn(column, currentValue)) {
    if (mode === 'multiple') {
      return (
        <FieldRow
          fieldName={column.name}
          hasEditedValue={hasEditedValue}
          isProtected={isProtected}
          isHidden={isHidden}
          isReadOnly={column.readonly}
          align={align}
          onLabelClick={onFieldLabelClick}
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
                  padding: '0',
                },
              }}
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
                <DiffViewer originalValue={currentValue} suggestedValue={suggestedValue} p="0" splitMinRows={1} />
              </ScrollArea>
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
                  padding: '3rem',
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
          padding: basicFieldPadding,
        },
      }}
    />
  );

  return (
    <FieldRow
      fieldName={column.name}
      showLabel={mode === 'multiple'}
      hasEditedValue={hasEditedValue}
      isProtected={isProtected}
      isHidden={isHidden}
      align={align}
      onLabelClick={onFieldLabelClick}
    >
      {hasSuggestion ? (
        <Stack h="auto" gap="xs" w="100%">
          <ScrollArea mah="100%" w="100%" type="hover" mb="xs">
            <DiffViewer
              originalValue={currentValue}
              suggestedValue={suggestedValue}
              p={mode === 'multiple' ? '0' : '3rem'}
            />
          </ScrollArea>
          {mode === 'multiple' && suggestionButtons}
        </Stack>
      ) : (
        textField
      )}
    </FieldRow>
  );
};
