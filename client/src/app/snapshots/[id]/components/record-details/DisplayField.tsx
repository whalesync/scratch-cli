import { EnhancedTextArea } from '@/app/components/EnhancedTextArea';
import { isLargeTextColumn, PostgresColumnType, SnapshotRecord, TableSpec } from '@/types/server-entities/snapshot';
import { ColumnView, isColumnHidden, isColumnProtected } from '@/types/server-entities/view';
import { Checkbox, NumberInput, Stack } from '@mantine/core';
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
}

export const DisplayField = (props: DisplayFieldProps) => {
  const { table, record, columnId, mode, align, currentView, updateField, onFieldLabelClick } = props;
  if (!record) return null;
  if (!table) return null;

  const column = table.columns.find((c) => c.id.wsId === columnId);
  if (!column) return null;

  const isHidden = currentView && isColumnHidden(table.id.wsId, columnId, currentView);
  const isProtected = currentView && isColumnProtected(table.id.wsId, columnId, currentView);
  const hasEditedValue = !!record.__edited_fields?.[columnId];
  const hasSuggestion = !!record.__suggested_values?.[columnId];

  if (isHidden) return null;

  if (column.pgType === PostgresColumnType.NUMERIC) {
    // this needs to be handled differently
    const currentValue = record.fields[columnId] as number;
    return (
      <FieldRow
        fieldName={column.name}
        hasEditedValue={hasEditedValue}
        isProtected={isProtected}
        isReadOnly={column.readonly}
        align={align}
        onFieldLabelClick={onFieldLabelClick}
      >
        <NumberInput
          key={columnId}
          value={currentValue}
          onChange={(value) => updateField(columnId, value.toString())}
          readOnly={column.readonly || hasSuggestion || isProtected}
          hideControls
          styles={{
            input: {
              borderColor: 'transparent',
              fontSize: '1rem',
            },
          }}
        />
      </FieldRow>
    );
  }

  if (column.pgType === PostgresColumnType.BOOLEAN) {
    const currentValue = (record.fields[columnId] as string).toLocaleLowerCase() === 'true';
    return (
      <FieldRow
        fieldName={column.name}
        hasEditedValue={hasEditedValue}
        isProtected={isProtected}
        isReadOnly={column.readonly}
        align={align}
        onFieldLabelClick={onFieldLabelClick}
      >
        <Checkbox
          key={columnId}
          checked={currentValue}
          onChange={(e) => updateField(columnId, e.target.checked.toString())}
          readOnly={column.readonly || hasSuggestion || isProtected}
        />
      </FieldRow>
    );
  }

  const currentValue = record.fields[columnId] as string;

  if (isLargeTextColumn(column, currentValue)) {
    if (mode === 'normal') {
      return (
        <FieldRow
          fieldName={column.name}
          hasEditedValue={hasEditedValue}
          isProtected={isProtected}
          isReadOnly={column.readonly}
          align={align}
          onFieldLabelClick={onFieldLabelClick}
        >
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
            readOnly={column.readonly || hasSuggestion || isProtected}
            styles={{
              input: {
                borderColor: 'transparent',
                fontSize: '1rem',
              },
            }}
          />
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
            readOnly={column.readonly || hasSuggestion || isProtected}
            styles={{
              input: {
                borderColor: 'transparent',
                fontSize: '1rem',
                padding: '2rem',
              },
            }}
          />
        </Stack>
      );
    }
  }

  return (
    <FieldRow
      fieldName={column.name}
      hasEditedValue={hasEditedValue}
      isProtected={isProtected}
      align={align}
      onFieldLabelClick={onFieldLabelClick}
    >
      <EnhancedTextArea
        flex={1}
        inputWrapperOrder={['input', 'label', 'description', 'error']}
        key={columnId}
        value={currentValue ?? ''}
        autosize
        minRows={1}
        resize="vertical"
        onChange={(e) => updateField(columnId, e.target.value)}
        readOnly={column.readonly || hasSuggestion || isProtected}
        styles={{
          input: {
            borderColor: 'transparent',
            fontSize: '1rem',
            // padding: '2rem',
            // backgroundColor: hasEditedValue ? '#e0fde0' : undefined,
          },
        }}
      />
    </FieldRow>
  );
};
