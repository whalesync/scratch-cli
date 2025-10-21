import { Button, Group, Text } from '@mantine/core';
import { Plus } from 'lucide-react';

export interface Command {
  id: string;
  display: string;
  description: string;
  execute: () => void;
}

export interface CommandSuggestionProps {
  suggestion: {
    id: string;
    display: string;
  };
  command: Command | undefined;
}

export const CommandSuggestion = ({ command }: CommandSuggestionProps) => {
  const handleExecute = () => {
    if (command?.execute) {
      command.execute();
    }
  };

  return (
    <Group justify="space-between" align="center" p="xs">
      <Group gap="xs">
        <Text size="sm" fw={600} c="blue">
          /{command?.display}
        </Text>
        <Text size="xs" c="dimmed">
          {command?.description}
        </Text>
      </Group>
      <Button
        size="xs"
        variant="light"
        leftSection={<Plus size={12} />}
        onClick={(e) => {
          e.stopPropagation();
          handleExecute();
        }}
      >
        Execute
      </Button>
    </Group>
  );
};
