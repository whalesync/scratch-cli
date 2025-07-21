'use client';

import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { FocusedCell } from './components/types';

interface FocusedCellsContextValue {
  readFocus: FocusedCell[];
  writeFocus: FocusedCell[];
  setReadFocus: (focus: FocusedCell[]) => void;
  setWriteFocus: (focus: FocusedCell[]) => void;
  addReadFocus: (cells: FocusedCell[]) => void;
  addWriteFocus: (cells: FocusedCell[]) => void;
  removeReadFocus: (cells: FocusedCell[]) => void;
  removeWriteFocus: (cells: FocusedCell[]) => void;
  clearReadFocus: () => void;
  clearWriteFocus: () => void;
  clearAllFocus: () => void;
}

export const FocusedCellsContext = createContext<FocusedCellsContextValue | undefined>(undefined);

interface FocusedCellsProviderProps {
  children: ReactNode;
}

export const FocusedCellsProvider = ({ children }: FocusedCellsProviderProps) => {
  const [readFocus, setReadFocus] = useState<FocusedCell[]>([]);
  const [writeFocus, setWriteFocus] = useState<FocusedCell[]>([]);

  const addReadFocus = useCallback((cells: FocusedCell[]) => {
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

  const addWriteFocus = useCallback((cells: FocusedCell[]) => {
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

  const removeReadFocus = useCallback((cells: FocusedCell[]) => {
    setReadFocus((prev) =>
      prev.filter((f) => !cells.some((c) => c.recordWsId === f.recordWsId && c.columnWsId === f.columnWsId)),
    );
  }, []);

  const removeWriteFocus = useCallback((cells: FocusedCell[]) => {
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

  const value: FocusedCellsContextValue = {
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
  };

  return <FocusedCellsContext.Provider value={value}>{children}</FocusedCellsContext.Provider>;
};

export const useFocusedCellsContext = () => {
  const context = useContext(FocusedCellsContext);
  if (context === undefined) {
    throw new Error('useFocusedCells must be used within a FocusedCellsProvider');
  }
  return context;
};
