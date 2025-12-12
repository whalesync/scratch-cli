import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { ColumnSpec } from '@/types/server-entities/workbook';
import { Tooltip } from '@mantine/core';
import { AlertCircleIcon } from 'lucide-react';

export const FieldErrorIcon = ({ record, columnDef }: { record: ProcessedSnapshotRecord; columnDef: ColumnSpec }) => {
  const errors = record.__errors?.byField?.[columnDef.id.wsId];
  if (!errors || errors.length === 0) {
    return null;
  }
  const worstSeverity = errors.reduce(
    (worst, current) => {
      return current.severity === 'error' ? 'error' : worst;
    },
    'warning' as 'warning' | 'error',
  );
  return (
    <Tooltip label={errors.map((error) => error.message).join('\n')} withinPortal>
      <AlertCircleIcon
        size={13}
        color={worstSeverity === 'error' ? 'var(--mantine-color-red-8)' : 'var(--mantine-color-yellow-6)'}
      />
    </Tooltip>
  );
};
