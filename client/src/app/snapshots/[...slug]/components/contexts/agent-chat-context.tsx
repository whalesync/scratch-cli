'use client';

import { useStyleGuides } from '@/hooks/use-style-guide';
import { RecordCell } from '@/types/common';
import { DataScope } from '@/types/server-entities/chat-session';
import { useLocalStorage } from '@mantine/hooks';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Manages all of the extra context state for the Agent chat, allowing it to be managed from different parts of the UI and the chat itself
 * - Focused cells
 * - Active resources
 * - Data scope
 * - Active record and column
 * - Read and write focus
 * - Active resources/style guides
 */
interface AgentChatContextValue {
  readFocus: RecordCell[];
  writeFocus: RecordCell[];
  dataScope: DataScope;
  activeRecordId: string | undefined;
  activeColumnId: string | undefined;
  setReadFocus: (focus: RecordCell[]) => void;
  setWriteFocus: (focus: RecordCell[]) => void;
  addReadFocus: (cells: RecordCell[]) => void;
  addWriteFocus: (cells: RecordCell[]) => void;
  removeReadFocus: (cells: RecordCell[]) => void;
  removeWriteFocus: (cells: RecordCell[]) => void;
  clearReadFocus: () => void;
  clearWriteFocus: () => void;
  clearAllFocus: () => void;
  setTableScope: () => void;
  setRecordScope: (recordId: string) => void;
  setColumnScope: (recordId: string, columnId: string) => void;
  activeResources: string[];
  setActiveResources: (ids: string[]) => void;
  activeModel: string;
  setActiveModel: (model: string) => void;
}

export const AgentChatContext = createContext<AgentChatContextValue | undefined>(undefined);

interface AgentChatContextProviderProps {
  children: ReactNode;
  snapshotId: string;
}

const DEFAULT_MODEL = 'openai/gpt-4o-mini';

export const AgentChatContextProvider = ({ children, snapshotId }: AgentChatContextProviderProps) => {
  const [dataScope, setDataScope] = useState<DataScope>('table');
  const [activeRecordId, setActiveRecordId] = useState<string | undefined>(undefined);
  const [activeColumnId, setActiveColumnId] = useState<string | undefined>(undefined);
  const [readFocus, setReadFocus] = useState<RecordCell[]>([]);
  const [writeFocus, setWriteFocus] = useState<RecordCell[]>([]);
  const [autoIncludedResourses, setAutoIncludedResourses] = useState<boolean>(false);

  const { styleGuides } = useStyleGuides();

  const [activeModel, setActiveModel] = useLocalStorage({
    key: `agent-chat-context-model-${snapshotId}`,
    defaultValue: DEFAULT_MODEL,
  });

  const [activeResources, setActiveResources] = useLocalStorage<string[]>({
    key: `agent-chat-context-${snapshotId}`,
    defaultValue: [],
  });

  useEffect(() => {
    if (!autoIncludedResourses && styleGuides.length > 0) {
      const autoIncludeStyleGuides = styleGuides
        .filter((sg) => sg.autoInclude && !activeResources.includes(sg.id))
        .map((sg) => sg.id);
      if (autoIncludeStyleGuides.length > 0) {
        setActiveResources([...activeResources, ...autoIncludeStyleGuides]);
        setAutoIncludedResourses(true);
      }
    }
  }, [styleGuides, autoIncludedResourses, activeResources, setActiveResources]);

  const addReadFocus = useCallback((cells: RecordCell[]) => {
    setReadFocus((prev) => {
      const newFocus = [...prev];
      cells.forEach((cell) => {
        const cellKey = `${cell.recordWsId}-${cell.columnWsId}`;
        const existingIndex = newFocus.findIndex((f) => `${f.recordWsId}-${f.columnWsId}` === cellKey);
        if (existingIndex === -1) {
          newFocus.push(cell);
        }
      });
      return newFocus;
    });
  }, []);

  const addWriteFocus = useCallback((cells: RecordCell[]) => {
    setWriteFocus((prev) => {
      const newFocus = [...prev];
      cells.forEach((cell) => {
        const cellKey = `${cell.recordWsId}-${cell.columnWsId}`;
        const existingIndex = newFocus.findIndex((f) => `${f.recordWsId}-${f.columnWsId}` === cellKey);
        if (existingIndex === -1) {
          newFocus.push(cell);
        }
      });
      return newFocus;
    });
  }, []);

  const removeReadFocus = useCallback((cells: RecordCell[]) => {
    setReadFocus((prev) =>
      prev.filter((f) => !cells.some((c) => c.recordWsId === f.recordWsId && c.columnWsId === f.columnWsId)),
    );
  }, []);

  const removeWriteFocus = useCallback((cells: RecordCell[]) => {
    setWriteFocus((prev) =>
      prev.filter((f) => !cells.some((c) => c.recordWsId === f.recordWsId && c.columnWsId === f.columnWsId)),
    );
  }, []);

  const clearReadFocus = useCallback(() => {
    setReadFocus([]);
  }, []);

  const clearWriteFocus = useCallback(() => {
    setWriteFocus([]);
  }, []);

  const clearAllFocus = useCallback(() => {
    setReadFocus([]);
    setWriteFocus([]);
  }, []);

  const setTableScope = useCallback(() => {
    setDataScope('table');
    setActiveRecordId(undefined);
    setActiveColumnId(undefined);
  }, []);

  const setRecordScope = useCallback((recordId: string) => {
    setDataScope('record');
    setActiveRecordId(recordId);
    setActiveColumnId(undefined);
  }, []);

  const setColumnScope = useCallback((recordId: string, columnId: string) => {
    setDataScope('column');
    setActiveRecordId(recordId);
    setActiveColumnId(columnId);
  }, []);

  const value: AgentChatContextValue = {
    readFocus,
    writeFocus,
    setReadFocus,
    setWriteFocus,
    addReadFocus,
    addWriteFocus,
    removeReadFocus,
    removeWriteFocus,
    clearReadFocus,
    clearWriteFocus,
    clearAllFocus,
    dataScope,
    activeRecordId,
    activeColumnId,
    setTableScope,
    setRecordScope,
    setColumnScope,
    activeResources,
    setActiveResources,
    activeModel,
    setActiveModel,
  };

  return <AgentChatContext.Provider value={value}>{children}</AgentChatContext.Provider>;
};

export const useAgentChatContext = () => {
  const context = useContext(AgentChatContext);
  if (context === undefined) {
    throw new Error('useAIChat must be used within a AIChatProvider');
  }
  return context;
};
