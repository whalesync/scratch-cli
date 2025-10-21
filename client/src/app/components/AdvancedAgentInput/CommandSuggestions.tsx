import { SuggestionItem } from './SuggestionItem';

export interface Command {
  id: string;
  display: string;
  description: string;
  execute: () => void;
}

export interface CommandSuggestionProps {
  command: Command;
}

export const CommandSuggestion = ({ command }: CommandSuggestionProps) => {
  return <SuggestionItem title={`/${command.display}`} description={command.description} />;
};
