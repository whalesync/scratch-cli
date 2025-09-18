import { Group, Text } from '@mantine/core';

export const FieldRow = ({
  fieldName,
  showLabel = true,
  align = 'flex-start',
  children,
  onLabelClick,
}: {
  fieldName: string;
  showLabel?: boolean;
  hasEditedValue?: boolean;
  isProtected?: boolean;
  isReadOnly?: boolean;
  isHidden?: boolean;
  align?: React.CSSProperties['alignItems'];
  children: React.ReactNode;
  onLabelClick?: () => void;
}) => {
  return (
    <Group align={align} wrap="nowrap" gap="xs" w="100%" p="0">
      {showLabel && (
        <Group
          w="15%"
          align="center"
          justify="flex-start"
          gap="xs"
          onClick={onLabelClick}
          style={{ cursor: onLabelClick ? 'pointer' : 'default' }}
        >
          <Text size="fit-content" fw={450}>
            {fieldName}
          </Text>
        </Group>
      )}
      <div style={{ flex: 1 }}>{children}</div>
    </Group>
  );
};
