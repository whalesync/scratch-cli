import { Text13Regular } from '@/app/components/base/text';
import { ChangeDotsGroup } from '@/app/components/field-value-wrappers/ChangeDotsGroup/ChangeDotsGroup';
import { ExistingChangeTypes, hasAnyChange } from '@/app/components/field-value-wrappers/ProcessedFieldValue';
import { RECORD_DETILE_SIDEBAR_W } from '@/app/workbooks/[...slug]/components/record-details/record-detail-constants';
import { Box, Group } from '@mantine/core';
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
};
export const FieldRow: FC<Props> = (props) => {
  const { fieldName, showLabel = true, children, onLabelClick, changeTypes, recordChangeTypes } = props;
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
        <Text13Regular c="var(--fg-secondary)">{fieldName}</Text13Regular>
      </Box>
      <Box style={{ flex: 1 }} p="sm">
        {children}
      </Box>
    </Group>
  );
};
