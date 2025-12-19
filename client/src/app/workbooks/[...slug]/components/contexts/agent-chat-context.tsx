'use client';

import { usePromptAssets } from '@/hooks/use-prompt-assets';
import { useSubscription } from '@/hooks/use-subscription';
import { useScratchPadUser } from '@/hooks/useScratchpadUser';
import {
  DEFAULT_AGENT_MODEL_CONTEXT_LENGTH,
  DEFAULT_AGENT_MODEL_ID,
  ModelOption,
  PersistedModelOption,
} from '@/types/common';
import { UserSetting } from '@/types/server-entities/users';
import { useLocalStorage } from '@mantine/hooks';
import { DataScope, WorkbookId } from '@spinner/shared-types';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

/**
 * Manages all of the extra context state for the Agent chat, allowing it to be managed from different parts of the UI and the chat itself
 * - Focused cells
 * - Active resources
 * - Data scope
 * - Active record and column
 * - Read and write focus
 * - Active resources/style guides
 * - Session cost tracking
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
  accumulatedCost: number;
  setAccumulatedCost: (cost: number) => void;
  resetCost: () => void;
}

export const AgentChatContext = createContext<AgentChatContextValue | undefined>(undefined);

interface AgentChatContextProviderProps {
  children: ReactNode;
  workbookId: WorkbookId;
}

export const AgentChatContextProvider = ({ children, workbookId }: AgentChatContextProviderProps) => {
  const { getUserSetting } = useScratchPadUser();
  const { isModelAllowed } = useSubscription();
  const [dataScope, setDataScope] = useState<DataScope>('table');
  const [activeRecordId, setActiveRecordId] = useState<string | undefined>(undefined);
  const [activeColumnId, setActiveColumnId] = useState<string | undefined>(undefined);
  const [autoIncludedResourses, setAutoIncludedResourses] = useState<boolean>(false);
  const [modelValidated, setModelValidated] = useState<boolean>(false);
  const [accumulatedCost, setAccumulatedCost] = useState<number>(0);

  const { promptAssets } = usePromptAssets();

  const defaultModelValue: PersistedModelOption = {
    value: getUserSetting(UserSetting.DEFAULT_LLM_MODEL, DEFAULT_AGENT_MODEL_ID) as string,
    contextLength: DEFAULT_AGENT_MODEL_CONTEXT_LENGTH,
  };

  const [activeModel, setActiveModel] = useLocalStorage({
    key: `agent-chat-context-model-v2-${workbookId}`,
    defaultValue: defaultModelValue,
  });

  // Validate stored model against subscription restrictions
  // If the stored model is no longer allowed (e.g., user downgraded), reset to default
  useEffect(() => {
    if (modelValidated) return;

    if (!isModelAllowed(activeModel.value)) {
      // The stored model is not allowed, reset to the user's default model
      const userDefaultModel = getUserSetting(UserSetting.DEFAULT_LLM_MODEL, DEFAULT_AGENT_MODEL_ID) as string;

      // Check if the user's default model is allowed, otherwise fall back to system default
      const fallbackModel = isModelAllowed(userDefaultModel) ? userDefaultModel : DEFAULT_AGENT_MODEL_ID;

      setActiveModel({
        value: fallbackModel,
        contextLength: DEFAULT_AGENT_MODEL_CONTEXT_LENGTH,
      });
    }
    setModelValidated(true);
  }, [activeModel.value, isModelAllowed, getUserSetting, setActiveModel, modelValidated]);

  const [activeResources, setActiveResources] = useLocalStorage<string[]>({
    key: `agent-chat-context-${workbookId}`,
    defaultValue: [],
  });

  useEffect(() => {
    if (!autoIncludedResourses && promptAssets.length > 0) {
      const autoIncludePromptAssets = promptAssets
        .filter((p) => p.autoInclude && !activeResources.includes(p.id))
        .map((p) => p.id);
      if (autoIncludePromptAssets.length > 0) {
        setActiveResources([...activeResources, ...autoIncludePromptAssets]);
        setAutoIncludedResourses(true);
      }
    }
  }, [promptAssets, autoIncludedResourses, activeResources, setActiveResources]);

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

  const resetCost = useCallback(() => {
    setAccumulatedCost(0);
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
    accumulatedCost,
    setAccumulatedCost,
    resetCost,
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
