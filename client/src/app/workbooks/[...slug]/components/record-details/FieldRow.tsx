import { Text13Regular } from '@/app/components/base/text';
import { Box, Group } from '@mantine/core';

export const FieldRow = ({
  fieldName,
  showLabel = true,
  children,
  onLabelClick,
}: {
  fieldName: string;
  showLabel?: boolean;
  hasEditedValue?: boolean;
  isReadOnly?: boolean;
  children: React.ReactNode;
  onLabelClick?: () => void;
}) => {
  if (!showLabel) {
    return <Box py="sm">{children}</Box>;
  }
  return (
    <Group wrap="nowrap" gap="0" w="100%" p="0" justify="stretch" align="flex-start">
      <Box w="20%" p="sm" onClick={onLabelClick} style={{ cursor: onLabelClick ? 'pointer' : 'default' }}>
        <Text13Regular c="var(--fg-secondary)">{fieldName}</Text13Regular>
      </Box>
      <Box style={{ flex: 1 }} p="sm">
        {children}
      </Box>
    </Group>
  );
};
