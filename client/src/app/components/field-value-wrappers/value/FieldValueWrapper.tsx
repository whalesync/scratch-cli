import { DiffText } from '@/app/components/field-value-wrappers/DiffText';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { ColumnSpec } from '@/types/server-entities/workbook';
import { Box, Group } from '@mantine/core';
import { FC } from 'react';
import { Text13Regular } from '../../base/text';
import { ChangeDotsGroup } from '../ChangeDotsGroup/ChangeDotsGroup';
import { SuggestionButtons } from '../SuggestionButtons';
import styles from './FieldValueWrapper.module.css';

type FieldValueWrapperProps = {
  className?: string;
  // Props for automatic rendering
  columnDef: ColumnSpec;
  record: ProcessedSnapshotRecord;
  showSuggestionButtons?: boolean;
  showChangeIndicators?: boolean;
  acceptCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>;
};

export const FieldValueWrapper: FC<FieldValueWrapperProps> = ({
  columnDef,
  record,
  showSuggestionButtons = false,
  showChangeIndicators = false,
  acceptCellValues,
  rejectCellValues,
}) => {
  // const processedFieldValue = processFieldValue(value, record, columnDef);

  const processedFieldValue = record.__processed_fields[columnDef.id.wsId];
  const changes = processedFieldValue.changes;
  const content = changes ? (
    <>
      <DiffText changes={changes} />
      {showSuggestionButtons && (
        <SuggestionButtons
          record={record}
          columnDef={columnDef}
          acceptCellValues={acceptCellValues}
          rejectCellValues={rejectCellValues}
        />
      )}
    </>
  ) : (
    <Text13Regular
      c={!record.isTableDirty || record.__dirty ? 'var(--fg-primary)' : 'var(--fg-secondary)'}
      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
    >
      {processedFieldValue.formattedValue}
    </Text13Regular>
  );

  // Single return with all the structure
  return (
    <Group className={styles.fieldValueWrapper}>
      {showChangeIndicators && <ChangeDotsGroup changeTypes={processedFieldValue.existingChangeTypes} />}
      <Box className={styles.fieldValueContentWrapper}>{content}</Box>
    </Group>
  );
};
