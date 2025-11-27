import { DiffText } from '@/app/components/field-value-wrappers/DiffText';
import { ColumnSpec, SnapshotRecord, formatFieldValue } from '@/types/server-entities/workbook';
import { Box, Group, Text, useMantineColorScheme } from '@mantine/core';
import { diffWordsWithSpace } from 'diff';
import { FC, ReactNode } from 'react';
import styles from './FieldValueWrapper.module.css';
import { SuggestionButtons } from './SuggestionButtons';

type FieldValueWrapperProps = {
  children?: ReactNode;
  className?: string;
  // Props for automatic rendering
  value?: unknown;
  columnDef?: ColumnSpec;
  record?: SnapshotRecord;
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
  const { colorScheme } = useMantineColorScheme();
  const isLightMode = colorScheme === 'light';

  if (!columnDef) {
    return null;
  }

  const formattedValue = formatFieldValue(value, columnDef);
  const suggestedValue = record?.__suggested_values?.[columnDef.id.wsId];

  const getContentAndClasses = () => {
    if (!record) {
      return {
        classes: [],
        content: <Text className="cell-text"></Text>,
      };
    }
    const classes = [];
    if (record?.__edited_fields?.[columnDef.id.wsId]) {
      classes.push(styles.cellValueHasAcceptedDeletions);
      classes.push(styles.cellValueHasAcceptedAdditions);
    }

    if (suggestedValue) {
      const changes = diffWordsWithSpace(formattedValue, String(suggestedValue));
      const hasSuggestedAdditions = changes.some((change) => change.added);
      const hassuggestedDeletions = changes.some((change) => change.removed);
      classes.push(styles.hasSuggestion);
      if (hasSuggestedAdditions) {
        classes.push(styles.hasSuggestedAdditions);
      }
      if (hassuggestedDeletions) {
        classes.push(styles.hasSuggestedDeletions);
      }
      if (hasSuggestedAdditions || hassuggestedDeletions) {
        classes.push(styles.hasSuggestion);
      }
      return {
        content: (
          <>
            <DiffText changes={changes} />
            {showSuggestionButtons && (
              <SuggestionButtons
                record={record}
                columnDef={columnDef}
                acceptCellValues={acceptCellValues}
                rejectCellValues={rejectCellValues}
                isLightMode={isLightMode}
              />
            )}
          </>
        ),
        classes,
      };
    } else {
      return {
        content: <Text className="cell-text">{formattedValue}</Text>,
        classes,
      };
    }
  };

  const { classes, content } = getContentAndClasses();

  // Single return with all the structure
  return (
    <Box className={`${styles.fieldValueWrapper} field-value-wrapper ${classes.join(' ')}`.trim()}>
      <Group gap={1} className={styles.dotGroup}>
        <Box
          className={`${styles.cellComponentAnyDot} ${styles.cellComponentLeftDot} ${styles.cellComponentDeletionDot}`}
        ></Box>
        <Box
          className={`${styles.cellComponentAnyDot} ${styles.cellComponentRightDot} ${styles.cellComponentAdditionDot}`}
        ></Box>
      </Group>
      <Box
        style={{
          flex: 1,
          minWidth: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}
        className="field-value-content"
      >
        {content}
      </Box>
    </Box>
  );
};
