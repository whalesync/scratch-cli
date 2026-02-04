import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { DataFolderPublishStatus } from '@spinner/shared-types';
import { Box, Checkbox, Group, Text } from '@mantine/core';
import { FC, ReactNode } from 'react';

interface Props {
  folder: DataFolderPublishStatus;
  isSelected: boolean;
  disabled: boolean;
  onToggle: (folderId: string) => void;
  statusText: ReactNode;
}

export const SelectDataFolderRow: FC<Props> = ({ folder, isSelected, disabled, onToggle, statusText }) => {
  return (
    <Group
      p="xs"
      style={{
        border: '0.5px solid var(--mantine-color-gray-3)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: isSelected
          ? 'var(--mantine-color-teal-0)'
          : disabled
            ? 'var(--mantine-color-gray-0)'
            : 'transparent',
        borderColor: isSelected ? 'var(--mantine-color-teal-4)' : 'var(--mantine-color-gray-3)',
        opacity: disabled ? 0.7 : 1,
      }}
      onClick={() => !disabled && onToggle(folder.folderId)}
    >
      <Checkbox
        checked={isSelected}
        onChange={() => {}} // Handled by Group onClick
        color="teal"
        style={{ pointerEvents: 'none' }} // Pass clicks to Group
        readOnly
        disabled={disabled}
      />
      <ConnectorIcon connector={folder.connectorService} size={22} />
      <Text fw={500} c={disabled ? 'dimmed' : undefined}>
        {folder.folderName}
      </Text>
      <Box ml="auto">{statusText}</Box>
    </Group>
  );
};
