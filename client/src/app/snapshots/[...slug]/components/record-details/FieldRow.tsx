import { StyledIcon } from '@/app/components/Icons/StyledIcon';
import { Center, Group, Text, Tooltip } from '@mantine/core';
import { EyeSlashIcon, LockIcon, PencilCircleIcon } from '@phosphor-icons/react';

export const FieldLabel = ({
  fieldName,
  hasEditedValue,
  isProtected,
  isHidden,
  w = '15%',
  onClick,
}: {
  fieldName: string;
  hasEditedValue?: boolean;
  isProtected?: boolean;
  isHidden?: boolean;
  w?: string;
  onClick?: () => void;
}) => {
  const iconSize = 12;
  const iconContainerSize = 14; // Tooltips don't work with just an icon component, it needs a container

  return (
    <Group
      w={w}
      align="center"
      justify="flex-start"
      gap="xs"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <Text size="fit-content" fw={500}>
        {fieldName}
      </Text>
      {hasEditedValue && (
        <Tooltip label="This field contains an updated value">
          <Center w={iconContainerSize} h={iconContainerSize}>
            <StyledIcon Icon={PencilCircleIcon} size={iconSize} c="green.5" />
          </Center>
        </Tooltip>
      )}
      {isProtected && (
        <Tooltip label="This field is protected from AI suggestions">
          <Center w={iconContainerSize} h={iconContainerSize}>
            <StyledIcon Icon={LockIcon} size={iconSize} c="gray.5" />
          </Center>
        </Tooltip>
      )}
      {isHidden && (
        <Tooltip label="This field is hidden from the AI in the current view">
          <Center w={iconContainerSize} h={iconContainerSize}>
            <StyledIcon Icon={EyeSlashIcon} size={iconSize} c="gray.5" />
          </Center>
        </Tooltip>
      )}
    </Group>
  );
};

export const FieldRow = ({
  fieldName,
  showLabel = true,
  hasEditedValue,
  isProtected,
  isHidden,
  align = 'flex-start',
  children,
  onFieldLabelClick,
}: {
  fieldName: string;
  showLabel?: boolean;
  hasEditedValue?: boolean;
  isProtected?: boolean;
  isReadOnly?: boolean;
  isHidden?: boolean;
  align?: React.CSSProperties['alignItems'];
  children: React.ReactNode;
  onFieldLabelClick?: () => void;
}) => {
  return (
    <Group align={align} wrap="nowrap" gap="xs" w="100%" p="0">
      {showLabel && (
        <FieldLabel
          w="15%"
          fieldName={fieldName}
          hasEditedValue={hasEditedValue}
          isProtected={isProtected}
          isHidden={isHidden}
          onClick={onFieldLabelClick}
        />
      )}
      <div style={{ flex: 1 }}>{children}</div>
    </Group>
  );
};
