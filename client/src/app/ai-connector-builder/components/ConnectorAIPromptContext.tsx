import { createContext, useContext, useState } from 'react';

/**
 * (chris) This is a terrible naming convention - we'll need to fix this :P
 */

interface ConnectorAIPromptContextValue {
  promptQueue: string[];
  addToPrompt: (prompt: string) => void;
  clearPromptQueue: () => void;
}

const ConnectorAIPromptContext = createContext<ConnectorAIPromptContextValue | undefined>(undefined);

export const ConnectorAIPromptProvider = ({ children }: { children: React.ReactNode }) => {
  const [promptQueue, setPromptQueue] = useState<string[]>([]);

  const addToPrompt = (prompt: string) => {
    setPromptQueue((prev) => [...prev, prompt]);
  };

  const clearPromptQueue = () => {
    setPromptQueue([]);
  };

  return (
    <ConnectorAIPromptContext.Provider value={{ promptQueue, addToPrompt, clearPromptQueue }}>
      {children}
    </ConnectorAIPromptContext.Provider>
  );
};

export const useConnectorAIPromptContext = () => {
  const context = useContext(ConnectorAIPromptContext);
  if (context === undefined) {
    throw new Error('useAIPromptContext must be used within a AIPromptProvider');
  }
  return context;
};
