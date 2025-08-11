import { Group, Text, Tooltip } from '@mantine/core';
import { LockIcon, PencilCircleIcon } from '@phosphor-icons/react';

export const FieldLabel = ({
  fieldName,
  hasEditedValue,
  isProtected,
  w = '15%',
  onClick,
}: {
  fieldName: string;
  hasEditedValue?: boolean;
  isProtected?: boolean;
  w?: string;
  onClick?: () => void;
}) => {
  return (
    <Group
      w={w}
      align="center"
      justify="flex-start"
      gap="xs"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <Text size="md" fw={500}>
        {fieldName}
      </Text>
      {hasEditedValue && (
        <Tooltip label="This field contains an upated value">
          <PencilCircleIcon size={12} />
        </Tooltip>
      )}
      {isProtected && (
        <Tooltip label="Protected">
          <LockIcon size={12} />
        </Tooltip>
      )}
    </Group>
  );
};

export const FieldRow = ({
  fieldName,
  hasEditedValue,
  isProtected,
  align = 'flex-start',
  children,
  onFieldLabelClick,
}: {
  fieldName: string;
  hasEditedValue?: boolean;
  isProtected?: boolean;
  isReadOnly?: boolean;
  align?: React.CSSProperties['alignItems'];
  children: React.ReactNode;
  onFieldLabelClick?: () => void;
}) => {
  return (
    <Group align={align} wrap="nowrap" gap="xs" w="100%">
      <FieldLabel
        w="15%"
        fieldName={fieldName}
        hasEditedValue={hasEditedValue}
        isProtected={isProtected}
        onClick={onFieldLabelClick}
      />
      <div style={{ flex: 1 }}>{children}</div>
    </Group>
  );
};
