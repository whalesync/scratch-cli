import { useRef } from 'react';

export interface UseUndoRedoReturn {
  addToHistory: (newValue: string) => void;
  handleUndo: (e: React.KeyboardEvent) => void;
  handleRedo: (e: React.KeyboardEvent) => void;
  setValue: (value: string) => void;
  setPreviousValue: (value: string) => void;
}

export const useUndoRedo = (
  value: string,
  setValue: (value: string) => void,
  previousValueRef: React.MutableRefObject<string>,
): UseUndoRedoReturn => {
  const historyRef = useRef<string[]>(['']);
  const historyIndexRef = useRef(0);

  const addToHistory = (newValue: string) => {
    const currentHistory = historyRef.current;
    const currentIndex = historyIndexRef.current;

    // Don't add if it's the same as the current value
    if (currentHistory[currentIndex] === newValue) {
      return;
    }

    // Remove any history after current index
    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(newValue);

    // Limit history size
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      historyIndexRef.current = newHistory.length - 1;
    }

    historyRef.current = newHistory;
  };

  const handleUndo = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      const currentIndex = historyIndexRef.current;
      if (currentIndex > 0) {
        historyIndexRef.current = currentIndex - 1;
        const previousValue = historyRef.current[historyIndexRef.current];
        setValue(previousValue);
        previousValueRef.current = previousValue;
      }
    }
  };

  const handleRedo = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      const currentIndex = historyIndexRef.current;
      const history = historyRef.current;
      if (currentIndex < history.length - 1) {
        historyIndexRef.current = currentIndex + 1;
        const nextValue = history[historyIndexRef.current];
        setValue(nextValue);
        previousValueRef.current = nextValue;
      }
    }
  };

  const setValueWithHistory = (newValue: string) => {
    setValue(newValue);
    addToHistory(newValue);
  };

  const setPreviousValue = (newValue: string) => {
    previousValueRef.current = newValue;
  };

  return {
    addToHistory,
    handleUndo,
    handleRedo,
    setValue: setValueWithHistory,
    setPreviousValue,
  };
};
