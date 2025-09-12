import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { TableSpec } from '@/types/server-entities/snapshot';
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { useSnapshotParams } from '../../hooks/use-snapshot-params';

interface ActiveRecord {
  recordId: string | undefined;
  columnId: string | undefined;
}

type DisplayMode = 'spreadsheet' | 'record';

interface TableContextValue {
  activeTable: TableSpec | undefined;
  setActiveTable: (table: TableSpec | undefined) => void;
  displayMode: DisplayMode;
  switchToRecordView: (recordId: string, columnId?: string) => void;
  switchToSpreadsheetView: () => void;
  activeRecord: ActiveRecord | undefined;
}

const TableContext = createContext<TableContextValue | undefined>(undefined);

interface TableProviderProps {
  children: ReactNode;
}

export const TableProvider = ({ children }: TableProviderProps) => {
  /** Dependant Hooks */
  const { snapshotId, recordId: recordIdParam, columnId: columnIdParam, updateSnapshotPath } = useSnapshotParams();
  const { setWriteFocus, setTableScope, setColumnScope, setRecordScope } = useAgentChatContext();

  /** State */
  const [activeTable, setActiveTable] = useState<TableSpec | undefined>(undefined);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(recordIdParam ? 'record' : 'spreadsheet');
  const [activeRecord, setActiveRecord] = useState<ActiveRecord>({
    recordId: recordIdParam,
    columnId: columnIdParam,
  });

  /** API */
  const switchDisplayMode = useCallback(
    (mode: 'spreadsheet' | 'record', recordId?: string, columnId?: string) => {
      if (!activeTable) {
        throw new Error('Active table not set');
      }

      setDisplayMode(mode);
      setActiveRecord({ recordId, columnId });

      if (mode === 'record' && recordId) {
        if (columnId) {
          setColumnScope(recordId, columnId);
          setWriteFocus([{ recordWsId: recordId, columnWsId: columnId }]);
          updateSnapshotPath(snapshotId, activeTable.id.wsId, recordId, columnId);
        } else {
          setRecordScope(recordId);
          updateSnapshotPath(snapshotId, activeTable.id.wsId, recordId);
        }
      }

      if (mode === 'spreadsheet') {
        setTableScope();
        setWriteFocus([]);
        updateSnapshotPath(snapshotId, activeTable.id.wsId);
      }
    },
    [activeTable, setColumnScope, setWriteFocus, updateSnapshotPath, snapshotId, setRecordScope, setTableScope],
  );

  const switchToRecordView = useCallback(
    (recordId: string, columnId?: string) => {
      switchDisplayMode('record', recordId, columnId);
    },
    [switchDisplayMode],
  );

  const switchToSpreadsheetView = useCallback(() => {
    switchDisplayMode('spreadsheet');
  }, [switchDisplayMode]);

  const value: TableContextValue = {
    activeTable,
    setActiveTable,
    displayMode,
    activeRecord,
    switchToRecordView,
    switchToSpreadsheetView,
  };

  return <TableContext.Provider value={value}>{children}</TableContext.Provider>;
};
export const useTableContext = () => {
  const context = useContext(TableContext);
  if (context === undefined) {
    throw new Error('useTableContext must be used within a TableProvider');
  }
  return context;
};
