'use client';

import { DataScope } from '@/types/server-entities/chat-session';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { RecordCell } from './components/types';

interface FocusedCellsContextValue {
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
}

export const FocusedCellsContext = createContext<FocusedCellsContextValue | undefined>(undefined);

interface FocusedCellsProviderProps {
  children: ReactNode;
}

export const FocusedCellsProvider = ({ children }: FocusedCellsProviderProps) => {
  const [dataScope, setDataScope] = useState<DataScope>('table');
  const [activeRecordId, setActiveRecordId] = useState<string | undefined>(undefined);
  const [activeColumnId, setActiveColumnId] = useState<string | undefined>(undefined);
  const [readFocus, setReadFocus] = useState<RecordCell[]>([]);
  const [writeFocus, setWriteFocus] = useState<RecordCell[]>([]);

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
    dataScope,
    activeRecordId,
    activeColumnId,
    setTableScope,
    setRecordScope,
    setColumnScope,
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
