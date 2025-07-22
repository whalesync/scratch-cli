import { createContext, useContext, useState } from 'react';

/**
 * (chris) This is a terrible naming convention - we'll need to fix this :P
 */

interface AIPromptContextValue {
  promptQueue: string[];
  addToPrompt: (prompt: string) => void;
  clearPromptQueue: () => void;
}

const AIPromptContext = createContext<AIPromptContextValue | undefined>(undefined);

export const AIPromptProvider = ({ children }: { children: React.ReactNode }) => {
  const [promptQueue, setPromptQueue] = useState<string[]>([]);

  const addToPrompt = (prompt: string) => {
    setPromptQueue((prev) => [...prev, prompt]);
  };

  const clearPromptQueue = () => {
    setPromptQueue([]);
  };

  return (
    <AIPromptContext.Provider value={{ promptQueue, addToPrompt, clearPromptQueue }}>
      {children}
    </AIPromptContext.Provider>
  );
};

export const useAIPromptContext = () => {
  const context = useContext(AIPromptContext);
  if (context === undefined) {
    throw new Error('useAIPromptContext must be used within a AIPromptProvider');
  }
  return context;
};
