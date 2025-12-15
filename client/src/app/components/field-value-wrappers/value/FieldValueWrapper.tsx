import { DiffText } from '@/app/components/field-value-wrappers/DiffText';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { ColumnSpec } from '@/types/server-entities/workbook';
import { Box, Group } from '@mantine/core';
import { FC, useEffect, useRef, useState } from 'react';
import { Text13Regular } from '../../base/text';
import { gettingStartedFlowUI } from '../../onboarding/getting-started/getting-started';
import { OnboardingStepContent } from '../../onboarding/OnboardingStepContent';
import { ChangeDotsGroup } from '../ChangeDotsGroup/ChangeDotsGroup';
import { FieldErrorIcon } from '../FieldErrorIcon';
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
  showOnboardingTooltip?: boolean;
};

export const FieldValueWrapper: FC<FieldValueWrapperProps> = ({
  columnDef,
  record,
  showSuggestionButtons = false,
  showChangeIndicators = false,
  acceptCellValues,
  rejectCellValues,
  showOnboardingTooltip = false,
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
          changes={changes}
          suggestedValue={processedFieldValue.suggestedValue}
          formattedValue={processedFieldValue.formattedValue}
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

  // Use intersection observer to hide tooltip when cell scrolls out of grid viewport
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!showOnboardingTooltip || !wrapperRef.current) return;

    // Find the AG Grid viewport container to use as the intersection root
    const gridViewport = wrapperRef.current.closest('.ag-body-viewport');

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        root: gridViewport,
        threshold: 1, // Hide when less than 50% visible
      },
    );

    observer.observe(wrapperRef.current);

    return () => observer.disconnect();
  }, [showOnboardingTooltip]);

  return (
    <Group className={styles.fieldValueWrapper} ref={wrapperRef}>
      {/* <div ref={wrapperRef} style={{ height: '100%' }} /> */}

      {showChangeIndicators && <ChangeDotsGroup changeTypes={processedFieldValue.existingChangeTypes} />}
      <FieldErrorIcon record={record} columnDef={columnDef} />
      <OnboardingStepContent
        flow={gettingStartedFlowUI}
        stepKey="suggestionsAccepted"
        hide={!isVisible || !showOnboardingTooltip}
      >
        <Box className={styles.fieldValueContentWrapper}>{content}</Box>
      </OnboardingStepContent>
    </Group>
  );
};
