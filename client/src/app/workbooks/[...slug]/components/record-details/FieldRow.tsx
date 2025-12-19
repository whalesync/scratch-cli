import { Text13Regular } from '@/app/components/base/text';
import { ChangeDotsGroup } from '@/app/components/field-value-wrappers/ChangeDotsGroup/ChangeDotsGroup';
import { FieldErrorIcon } from '@/app/components/field-value-wrappers/FieldErrorIcon';
import { ExistingChangeTypes, hasAnyChange } from '@/app/components/field-value-wrappers/ProcessedFieldValue';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { RECORD_DETILE_SIDEBAR_W } from '@/app/workbooks/[...slug]/components/record-details/record-detail-constants';
import { ProcessedSnapshotRecord } from '@/hooks/use-snapshot-table-records';
import { ColumnSpec } from '@spinner/shared-types';
import { Box, Group, Tooltip } from '@mantine/core';
import { PenOffIcon } from 'lucide-react';
import { FC } from 'react';

type Props = {
  fieldName: string;
  showLabel?: boolean;
  hasEditedValue?: boolean;
  isReadOnly?: boolean;
  children: React.ReactNode;
  onLabelClick?: () => void;
  changeTypes: ExistingChangeTypes;
  recordChangeTypes: ExistingChangeTypes;
  record: ProcessedSnapshotRecord;
  columnDef: ColumnSpec;
};
export const FieldRow: FC<Props> = (props) => {
  const {
    fieldName,
    showLabel = true,
    isReadOnly,
    children,
    onLabelClick,
    changeTypes,
    recordChangeTypes,
    record,
    columnDef,
  } = props;
  if (!showLabel) {
    return <Box py="sm">{children}</Box>;
  }

  const showDots = hasAnyChange(recordChangeTypes);

  return (
    <Group wrap="nowrap" gap="0" w="100%" p="0" justify="stretch" align="flex-start">
      <Box
        w={RECORD_DETILE_SIDEBAR_W}
        p="sm"
        onClick={onLabelClick}
        style={{ cursor: onLabelClick ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '8px' }}
      >
        {showDots && <ChangeDotsGroup changeTypes={changeTypes} />}
        <FieldErrorIcon record={record} columnDef={columnDef} />
        <Text13Regular c="var(--fg-secondary)" style={{ flex: 1 }}>
          {fieldName}
        </Text13Regular>
        {isReadOnly && (
          <Tooltip label="This field is readonly" position="top" withArrow>
            <span style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
              <StyledLucideIcon Icon={PenOffIcon} size={12} />
            </span>
          </Tooltip>
        )}
      </Box>
      <Box style={{ flex: 1, minWidth: 0 }} p="sm">
        {children}
      </Box>
    </Group>
  );
};
