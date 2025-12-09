import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { ColumnSpec } from '@/types/server-entities/workbook';
import { Tooltip } from '@mantine/core';
import { AlertCircleIcon } from 'lucide-react';

export const FieldErrorIcon = ({ record, columnDef }: { record: ProcessedSnapshotRecord; columnDef: ColumnSpec }) => {
  const errors = record.__errors?.byField?.[columnDef.id.wsId];
  if (!errors) {
    return null;
  }
  return (
    <Tooltip label={errors.join('\n')} withinPortal>
      <AlertCircleIcon size={13} color="var(--mantine-color-red-8)" />
    </Tooltip>
  );
};
