'use client';

import { useUndoRedo } from '@/hooks/useUndoRedo';
import { mentionsApi } from '@/lib/api/mentions';
import { RecordMentionEntity, ResourceMentionEntity } from '@/types/server-entities/mentions';
import { Loader } from '@mantine/core';
import { SnapshotTableId, TableSpec, Workbook, WorkbookId } from '@spinner/shared-types';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { MentionsInput } from 'react-mentions';
import classNames from './AdvancedAgentInput.module.css';
import { Command, CommandSuggestion } from './CommandSuggestions';
import { SuggestionItem } from './SuggestionItem';
import { TypesafeMention } from './TypesafeMention';

const MIN_QUERY_LENGTH = 2;

export interface AdvancedAgentInputRef {
  setValue: (value: string) => void;
  clear: () => void;
  focus: () => void;
}

interface AdvancedAgentInputProps {
  tableId: SnapshotTableId;
  workbook?: Workbook;
  onMessageChange?: (message: string) => void;
  onSendMessage?: () => void;
  disabled?: boolean;
  onFocus?: () => void;
  commands?: Command[];
  inProgress?: boolean;
}

const revert = () => {
  console.log('Revert last action');
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

export const AdvancedAgentInput = forwardRef<AdvancedAgentInputRef, AdvancedAgentInputProps>(
  (
    { tableId, workbook, onMessageChange, onSendMessage, disabled = false, onFocus, commands = [], inProgress = false },
    ref,
  ) => {
    const [value, setValueState] = useState('');
    const previousValueRef = useRef('');
    const suggestionsPortalRef = useRef<HTMLDivElement | null>(null);
    const { handleUndo, handleRedo, setValue, setPreviousValue } = useUndoRedo(value, setValueState, previousValueRef);

    // Create portal host for suggestions on mount
    if (typeof window !== 'undefined' && !suggestionsPortalRef.current) {
      let portalHost = document.getElementById('mentions-suggestions-portal');
      if (!portalHost) {
        portalHost = document.createElement('div');
        portalHost.id = 'mentions-suggestions-portal';
        document.body.appendChild(portalHost);
      }
      suggestionsPortalRef.current = portalHost as HTMLDivElement;
    }

    const executeCommand = (commandId: string) => {
      const command = commands.find((c) => c.id === commandId);
      if (command) {
        command.execute();
      }
    };

    const handleResourceRemoved = (id: string, display: string) => {
      console.debug('Record mention removed:', display, 'ID:', id);
      // Add your custom logic here
      // Example: update a list, trigger an API call, etc.
    };

    const handleRecordRemoved = (id: string, display: string) => {
      console.debug('Record mention removed:', display, 'ID:', id);
      // Add your custom logic here
    };

    const handleTableRemoved = (id: string, display: string) => {
      console.debug('Table mention removed:', display, 'ID:', id);
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

      // Check for all mention types (commands, resources=@, records=#, tables=$)
      const commandPattern = /\/\[(\w+)\]\((cmd\d+)\)/g;
      const resourcePattern = /@\[([^\]]+)\]\(([^)]+)\)/g; // resources
      const recordPattern = /#\[([^\]]+)\]\(([^)]+)\)/g; // records
      const tablePattern = /\$\[([^\]]+)\]\(([^)]+)\)/g; // tables

      const currentCommands = [...newValue.matchAll(commandPattern)];
      const previousCommands = previousValueRef.current ? [...previousValueRef.current.matchAll(commandPattern)] : [];

      const currentResources = [...newValue.matchAll(resourcePattern)];
      const previousResources = previousValueRef.current ? [...previousValueRef.current.matchAll(resourcePattern)] : [];

      const currentRecords = [...newValue.matchAll(recordPattern)];
      const previousRecords = previousValueRef.current ? [...previousValueRef.current.matchAll(recordPattern)] : [];

      const currentTables = [...newValue.matchAll(tablePattern)];
      const previousTables = previousValueRef.current ? [...previousValueRef.current.matchAll(tablePattern)] : [];

      // Check if a command was added
      if (currentCommands.length > previousCommands.length) {
        const lastMatch = currentCommands[currentCommands.length - 1];
        const cleanedValue = newValue.replace(lastMatch[0], '');
        setValue(cleanedValue);
        setPreviousValue(cleanedValue);
      }
      // Check if a person mention was removed
      else if (currentResources.length < previousResources.length) {
        const removedResource = previousResources.find((prev) => !currentResources.some((curr) => curr[0] === prev[0]));
        if (removedResource) {
          handleResourceRemoved(removedResource[2], removedResource[1]);
        }
        setValue(newValue);
        setPreviousValue(newValue);
      }
      // Check if a project mention was removed
      else if (currentRecords.length < previousRecords.length) {
        const removedRecord = previousRecords.find((prev) => !currentRecords.some((curr) => curr[0] === prev[0]));
        if (removedRecord) {
          handleRecordRemoved(removedRecord[2], removedRecord[1]);
        }
        setValue(newValue);
        setPreviousValue(newValue);
      } else if (currentTables.length < previousTables.length) {
        const removedTable = previousTables.find((prev) => !currentTables.some((curr) => curr[0] === prev[0]));
        if (removedTable) {
          handleTableRemoved(removedTable[2], removedTable[1]);
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

    const inputRef = useRef<HTMLTextAreaElement | null>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      setValue: (newValue: string) => {
        setValue(newValue);
        setPreviousValue(newValue);
      },
      clear: () => {
        setValue('');
        setPreviousValue('');
      },
      focus: () => {
        inputRef.current?.focus();
      },
    }));

    // Set the local ref
    const setRefs = (element: HTMLTextAreaElement | null) => {
      inputRef.current = element;
    };

    return (
      <div className={classNames.mentions__wrapper} onClick={() => inputRef.current?.focus()}>
        {inProgress && (
          <div className={classNames.spinner__overlay}>
            <Loader size="sm" color="var(--fg-muted)" />
          </div>
        )}
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
          placeholder={inProgress ? `` : `Type a message ...`}
          classNames={classNames}
          spellCheck={false}
          allowSuggestionsAboveCursor={true}
          inputRef={setRefs}
          suggestionsPortalHost={suggestionsPortalRef.current ?? undefined}
        >
          {/* Resource Mentions */}
          <TypesafeMention
            trigger="@"
            markup="@[__display__](__id__)"
            displayTransform={(id, display) => ` @${display} `}
            style={{ backgroundColor: 'var(--mantine-color-gray-3)' }}
            data={async (
              query: string,
              callback: (results: { id: string; display: string; title: string; preview: string }[]) => void,
            ) => {
              if (!tableId) {
                callback([]);
                return;
              }
              if (query.length < MIN_QUERY_LENGTH) {
                callback([]);
                return;
              }
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

          {/* Record Mentions */}
          <TypesafeMention
            trigger="#"
            markup="#[__display__](__id__)"
            displayTransform={(id, display) => ` #${display} `}
            style={{ backgroundColor: 'var(--mantine-color-gray-3)' }}
            data={async (
              query: string,
              callback: (results: { id: string; display: string; title: string }[]) => void,
            ) => {
              if (!workbook?.id) {
                callback([]);
                return;
              }

              if (!tableId) {
                callback([]);
                return;
              }
              if (query.length < MIN_QUERY_LENGTH) {
                callback([]);
                return;
              }

              try {
                const records = await mentionsApi.searchRecords({
                  text: query,
                  workbookId: workbook.id as WorkbookId,
                  tableId: tableId,
                });
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

          {/* Commands Mentions */}
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

          {/* Table / Column Mentions */}
          <TypesafeMention
            trigger="$"
            markup="$[__display__](__id__)"
            displayTransform={(id, display) => ` $${display} `}
            style={{ backgroundColor: 'var(--mantine-color-gray-3)' }}
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
      </div>
    );
  },
);

AdvancedAgentInput.displayName = 'AdvancedAgentInput';
