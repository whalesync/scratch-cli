'use client';

import { useUndoRedo } from '@/hooks/useUndoRedo';
import { mentionsApi, RecordMentionEntity, ResourceMentionEntity } from '@/lib/api/mentions';
import { TableSpec, Workbook } from '@/types/server-entities/workbook';
import { FC, useRef, useState } from 'react';
import { MentionsInput } from 'react-mentions';
import classNames from './AdvancedAgentInput.module.css';
import { Command, CommandSuggestion } from './CommandSuggestions';
import { SuggestionItem } from './SuggestionItem';
import { TypesafeMention } from './TypesafeMention';

interface AdvancedAgentInputProps {
  tableId: string;
  workbook?: Workbook;
  onMessageChange?: (message: string) => void;
  onSendMessage?: () => void;
  disabled?: boolean;
  onFocus?: () => void;
  commands?: Command[];
}

const revert = () => {
  alert('TODO: Revert last action'); // TODO: Implement actual revert logic here
};

// Custom render functions for suggestions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderCommandSuggestion = (suggestion: any, commands: Command[]) => {
  const command = commands.find((c) => c.id === suggestion.id);
  return <CommandSuggestion command={command!} />;
};

const renderResourceSuggestion = (suggestion: unknown) => {
  return (
    <SuggestionItem
      title={(suggestion as ResourceMentionEntity).title}
      description={(suggestion as ResourceMentionEntity).preview}
    />
  );
};

const renderRecordSuggestion = (suggestion: unknown) => {
  return <SuggestionItem title={(suggestion as RecordMentionEntity).title} description={''} />;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderTableSuggestion = (suggestion: any) => {
  return <SuggestionItem title={suggestion.display} description={'Table'} />;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const renderFieldSuggestion = (suggestion: any) => {
  return <SuggestionItem title={suggestion.display} description={'Field'} />;
};

export const AdvancedAgentInput: FC<AdvancedAgentInputProps> = ({
  tableId,
  workbook,
  onMessageChange,
  onSendMessage,
  disabled = false,
  onFocus,
  commands = [],
}) => {
  const [value, setValueState] = useState('');
  const previousValueRef = useRef('');
  const { handleUndo, handleRedo, setValue, setPreviousValue } = useUndoRedo(value, setValueState, previousValueRef);

  const executeCommand = (commandId: string) => {
    const command = commands.find((c) => c.id === commandId);
    if (command) {
      command.execute();
    }
  };

  const handlePersonRemoved = (id: string, display: string) => {
    console.debug('Record mention removed:', display, 'ID:', id);
    // Add your custom logic here
    // Example: update a list, trigger an API call, etc.
  };

  const handleProjectRemoved = (id: string, display: string) => {
    console.debug('Resource mention removed:', display, 'ID:', id);
    // Add your custom logic here
  };

  const handleChange = (event: { target: { value: string } }) => {
    const newValue = event.target.value;

    // Call onMessageChange if provided
    if (onMessageChange) {
      onMessageChange(newValue);
    }

    // Check for double slash (//) - special revert command
    if (newValue == '//') {
      // Execute revert action
      revert();
      setValue('');
      setPreviousValue('');
      return;
    }

    // Check for all mention types (commands, records=@, resources=#)
    const commandPattern = /\/\[(\w+)\]\((cmd\d+)\)/g;
    const peoplePattern = /@\[([^\]]+)\]\(([^)]+)\)/g; // records
    const projectPattern = /#\[([^\]]+)\]\(([^)]+)\)/g; // resources

    const currentCommands = [...newValue.matchAll(commandPattern)];
    const previousCommands = previousValueRef.current ? [...previousValueRef.current.matchAll(commandPattern)] : [];

    const currentPeople = [...newValue.matchAll(peoplePattern)];
    const previousPeople = previousValueRef.current ? [...previousValueRef.current.matchAll(peoplePattern)] : [];

    const currentProjects = [...newValue.matchAll(projectPattern)];
    const previousProjects = previousValueRef.current ? [...previousValueRef.current.matchAll(projectPattern)] : [];

    // Check if a command was added
    if (currentCommands.length > previousCommands.length) {
      const lastMatch = currentCommands[currentCommands.length - 1];
      const cleanedValue = newValue.replace(lastMatch[0], '');
      setValue(cleanedValue);
      setPreviousValue(cleanedValue);
    }
    // Check if a person mention was removed
    else if (currentPeople.length < previousPeople.length) {
      const removedPerson = previousPeople.find((prev) => !currentPeople.some((curr) => curr[0] === prev[0]));
      if (removedPerson) {
        handlePersonRemoved(removedPerson[2], removedPerson[1]);
      }
      setValue(newValue);
      setPreviousValue(newValue);
    }
    // Check if a project mention was removed
    else if (currentProjects.length < previousProjects.length) {
      const removedProject = previousProjects.find((prev) => !currentProjects.some((curr) => curr[0] === prev[0]));
      if (removedProject) {
        handleProjectRemoved(removedProject[2], removedProject[1]);
      }
      setValue(newValue);
      setPreviousValue(newValue);
    }
    // Normal change
    else {
      setValue(newValue);
      setPreviousValue(newValue);
    }
  };

  return (
    <MentionsInput
      value={value}
      onChange={handleChange}
      onKeyDown={(e) => {
        handleUndo(e);
        handleRedo(e);

        // Handle Enter key to send message
        if (e.key === 'Enter' && !e.shiftKey && onSendMessage) {
          e.preventDefault();
          onSendMessage();
          // Clear the input after sending
          setValue('');
          setPreviousValue('');
        }
      }}
      onFocus={onFocus}
      disabled={disabled}
      placeholder={`Type your message ...`}
      // className="mentions"
      style={{ height: 100 }}
      classNames={classNames}
      spellCheck={false}
    >
      <TypesafeMention
        trigger="@"
        markup="@[__display__](__id__)"
        displayTransform={(id, display) => ` @${display} `}
        style={{
          backgroundColor: 'rgba(16, 20, 21, 0.7)',
        }}
        data={async (
          query: string,
          callback: (results: { id: string; display: string; title: string; preview: string }[]) => void,
        ) => {
          try {
            const resources = await mentionsApi.searchResources({ text: query });
            const items = resources.map((r) => ({
              id: r.id,
              display: r.title,
              title: r.title,
              preview: r.preview,
            }));
            callback(items);
          } catch (error) {
            console.error('Error fetching resource mentions:', error);
            callback([]);
          }
        }}
        renderSuggestion={renderResourceSuggestion}
        appendSpaceOnAdd
      />

      <TypesafeMention
        trigger="#"
        markup="#[__display__](__id__)"
        displayTransform={(id, display) => ` #${display} `}
        style={{
          backgroundColor: 'rgba(68, 68, 68, 0.7)',
          color: '#0077b6',
        }}
        data={async (query: string, callback: (results: { id: string; display: string; title: string }[]) => void) => {
          try {
            const records = await mentionsApi.searchRecords({ text: query, tableId: tableId });
            const items = records.map((r) => ({
              id: r.id,
              display: r.title,
              title: r.title,
            }));
            callback(items);
          } catch (error) {
            console.error('Error fetching record mentions:', error);
            callback([]);
          }
        }}
        renderSuggestion={renderRecordSuggestion}
        appendSpaceOnAdd
      />

      <TypesafeMention
        trigger="/"
        markup="/[__display__](__id__)"
        data={commands}
        displayTransform={() => ``}
        renderSuggestion={(suggestion) => renderCommandSuggestion(suggestion, commands)}
        onAdd={(id, display) => {
          executeCommand(String(id));
          return display;
        }}
        appendSpaceOnAdd
      />
      <TypesafeMention
        trigger="$"
        markup="$[__display__](__id__)"
        displayTransform={(id, display) => ` $${display} `}
        style={{
          backgroundColor: 'rgba(34, 99, 94, 0.7)',
          color: '#00bb00',
        }}
        data={(query, callback) => {
          if (!workbook?.snapshotTables) {
            callback([]);
            return;
          }

          // Get all tables
          const allTables = workbook.snapshotTables.map((snapshotTable) => {
            const table = snapshotTable.tableSpec as TableSpec;
            return {
              id: `tbl_${snapshotTable.id}`,
              display: table.name,
              type: 'table',
              tableId: snapshotTable.id,
            };
          });

          // Get all fields
          const allFields = workbook.snapshotTables.flatMap((snapshotTable) => {
            const table = snapshotTable.tableSpec as TableSpec;
            console.debug(`Processing table ${table.name} with ${table.columns.length} columns`);
            return table.columns.map((column) => ({
              id: `fld_${snapshotTable.id}_${column.id.wsId}`,
              display: `${table.name}.${column.name}`,
              type: 'field',
              tableId: snapshotTable.id,
              fieldId: column.id.wsId,
              tableName: table.name,
              fieldName: column.name,
            }));
          });

          // Combine tables and fields
          const allItems = [...allTables, ...allFields];
          // Filter by query
          const filteredItems = allItems.filter((item) => item.display.toLowerCase().includes(query.toLowerCase()));
          callback(filteredItems);
        }}
        renderSuggestion={(suggestion: { id: string; display: string; type: string }) => {
          if (suggestion.type === 'table') {
            return renderTableSuggestion(suggestion);
          } else {
            return renderFieldSuggestion(suggestion);
          }
        }}
        appendSpaceOnAdd
      />
    </MentionsInput>
  );
};
