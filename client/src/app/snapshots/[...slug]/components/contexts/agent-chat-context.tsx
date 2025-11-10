'use client';

import { useStyleGuides } from '@/hooks/use-style-guide';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import { ModelOption, PersistedModelOption } from '@/types/common';
import { DataScope } from '@/types/server-entities/chat-session';
import { UserSetting } from '@/types/server-entities/users';
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
  dataScope: DataScope;
  activeRecordId: string | undefined;
  activeColumnId: string | undefined;
  setTableScope: () => void;
  setRecordScope: (recordId: string) => void;
  setColumnScope: (recordId: string, columnId: string) => void;
  activeResources: string[];
  setActiveResources: (ids: string[]) => void;
  activeModel: PersistedModelOption;
  setActiveModel: (model: ModelOption) => void;
}

export const AgentChatContext = createContext<AgentChatContextValue | undefined>(undefined);

interface AgentChatContextProviderProps {
  children: ReactNode;
  snapshotId: string;
}

const DEFAULT_MODEL: PersistedModelOption = { value: 'openai/gpt-4o-mini', contextLength: 200000 };

export const AgentChatContextProvider = ({ children, snapshotId }: AgentChatContextProviderProps) => {
  const { getUserSetting } = useScratchPadUser();
  const [dataScope, setDataScope] = useState<DataScope>('table');
  const [activeRecordId, setActiveRecordId] = useState<string | undefined>(undefined);
  const [activeColumnId, setActiveColumnId] = useState<string | undefined>(undefined);
  const [autoIncludedResourses, setAutoIncludedResourses] = useState<boolean>(false);

  const { styleGuides } = useStyleGuides();

  const defaultModelValue: PersistedModelOption = {
    value: getUserSetting(UserSetting.DEFAULT_LLM_MODEL, DEFAULT_MODEL.value) as string,
    contextLength: DEFAULT_MODEL.contextLength,
  };

  const [activeModel, setActiveModel] = useLocalStorage({
    key: `agent-chat-context-model-v2-${snapshotId}`,
    defaultValue: defaultModelValue,
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
