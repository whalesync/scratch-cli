import { DiffText } from '@/app/components/field-value-wrappers/DiffText';
import { ColumnSpec, SnapshotRecord } from '@/types/server-entities/workbook';
import { Box, Text } from '@mantine/core';
import { FC, ReactNode } from 'react';
import { ChangeDotsGroup } from './ChangeDotsGroup/ChangeDotsGroup';
import styles from './FieldValueWrapper.module.css';
import { processFieldValue } from './ProcessedFieldValue';
import { SuggestionButtons } from './SuggestionButtons';

/**
 * The user of the component can attach the following classes to any parent element:
 * .hasSuggestedAdditions
 * .hasSuggestedDeletions
 * .hasAcceptedAdditions
 * .hasAcceptedDeletions
 */

type FieldValueWrapperProps = {
  children?: ReactNode;
  className?: string;
  // Props for automatic rendering
  value?: unknown;
  columnDef: ColumnSpec;
  record: SnapshotRecord;
  showSuggestionButtons?: boolean;
  acceptCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues?: (items: { wsId: string; columnId: string }[]) => Promise<void>;
};

export const FieldValueWrapper: FC<FieldValueWrapperProps> = ({
  value,
  columnDef,
  record,
  showSuggestionButtons = false,
  acceptCellValues,
  rejectCellValues,
}) => {
  const processedFieldValue = processFieldValue(value, record, columnDef);

  const content = processedFieldValue.changes ? (
    <>
      <DiffText changes={processedFieldValue.changes} />
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
    <Text className="cell-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {processedFieldValue.formattedValue}
    </Text>
  );

  // Single return with all the structure
  return (
    <Box className={styles.fieldValueWrapper}>
      <ChangeDotsGroup changeTypes={processedFieldValue.existingChangeTypes} />
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {content}
      </Box>
    </Box>
  );
};
