import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { RecordOperation } from '@/types/server-entities/records';
import { TableSpec } from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useSnapshotParams } from '../../hooks/use-snapshot-params';
import { useSnapshotContext } from './SnapshotContext';
import { useAgentChatContext } from './agent-chat-context';

export interface ActiveRecord {
  recordId: string | undefined;
  columnId: string | undefined;
}

export interface PendingUpdate {
  recordWsId: string;
  field: string;
  value: string;
}

// type DisplayMode = 'spreadsheet' | 'record' | 'new-spreadsheet';

interface TableContextValue {
  activeTable: TableSpec | undefined;
  setActiveTable: (table: TableSpec | undefined) => void;
  // displayMode: DisplayMode;
  // switchToRecordView: (recordId: string, columnId?: string) => Promise<void>;
  // switchToSpreadsheetView: () => Promise<void>;
  // switchToNewSpreadsheetView: () => Promise<void>;
  switchDisplayMode: (recordId?: string, columnId?: string) => Promise<void>;
  activeRecord: ActiveRecord | undefined;
  addPendingChange: (update: PendingUpdate) => void;
  savePendingUpdates: () => Promise<void>;
  pendingChanges: PendingUpdate[];
  savingPendingChanges: boolean;
}

const TableContext = createContext<TableContextValue | undefined>(undefined);

interface TableProviderProps {
  children: ReactNode;
}

export const TableProvider = ({ children }: TableProviderProps) => {
  /** Dependant Hooks */
  const { snapshotId, recordId: recordIdParam, columnId: columnIdParam, updateSnapshotPath } = useSnapshotParams();
  const { setWriteFocus, setTableScope, setColumnScope, setRecordScope } = useAgentChatContext();
  const { viewDataAsAgent, currentViewId } = useSnapshotContext();
  /** State */
  const [activeTable, setActiveTable] = useState<TableSpec | undefined>(undefined);
  // const [displayMode, setDisplayMode] = useState<DisplayMode>(recordIdParam ? 'record' : 'spreadsheet');
  const [activeRecord, setActiveRecord] = useState<ActiveRecord>({
    recordId: recordIdParam,
    columnId: columnIdParam,
  });
  const [pendingChanges, setPendingChanges] = useState<PendingUpdate[]>([]);
  const [savingPendingChanges, setSavingPendingChanges] = useState(false);

  const { bulkUpdateRecords } = useSnapshotTableRecords({
    snapshotId: snapshotId,
    tableId: activeTable?.id.wsId ?? '',
    viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
  });

  /** API */

  const addPendingChange = useCallback(
    (update: PendingUpdate) => {
      console.debug('addPendingChange', update);
      const existing = pendingChanges.findIndex(
        (candidate) => candidate.recordWsId === update.recordWsId && candidate.field === update.field,
      );
      if (existing !== -1) {
        // reset the value in the list
        const newPendingUpdates = [...pendingChanges];
        newPendingUpdates[existing] = { recordWsId: update.recordWsId, field: update.field, value: update.value };
        setPendingChanges(newPendingUpdates);
      } else {
        setPendingChanges([
          ...pendingChanges,
          { recordWsId: update.recordWsId, field: update.field, value: update.value },
        ]);
      }
    },
    [pendingChanges],
  );

  const savePendingUpdates = useCallback(async () => {
    if (pendingChanges.length === 0) {
      return;
    }

    console.debug('savePendingUpdates for table', activeTable?.id.wsId, pendingChanges);

    // TODO: collapse updates to the same record into a single operation
    const ops: RecordOperation[] = pendingChanges.map((update) => ({
      op: 'update',
      wsId: update.recordWsId,
      data: { [update.field]: update.value },
    }));

    try {
      setSavingPendingChanges(true);
      await bulkUpdateRecords({ ops });
      setPendingChanges([]);
      await sleep(200);
    } catch (e) {
      const error = e as Error;
      ScratchpadNotifications.error({
        title: 'Error updating fields',
        message: error.message,
      });
    } finally {
      setSavingPendingChanges(false);
    }
  }, [pendingChanges, bulkUpdateRecords, activeTable?.id.wsId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (activeRecord) {
        savePendingUpdates();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [savePendingUpdates, activeRecord, activeTable?.id.wsId]);

  const switchDisplayMode = useCallback(
    async (recordId?: string, columnId?: string) => {
      if (!activeTable) {
        throw new Error('Active table not set');
      }

      // setDisplayMode(mode);
      setActiveRecord({ recordId, columnId });
      await savePendingUpdates();

      if (recordId) {
        if (columnId) {
          setColumnScope(recordId, columnId);
          setWriteFocus([{ recordWsId: recordId, columnWsId: columnId }]);
          updateSnapshotPath(snapshotId, activeTable.id.wsId, recordId, columnId);
        } else {
          setRecordScope(recordId);
          updateSnapshotPath(snapshotId, activeTable.id.wsId, recordId);
        }
      } else {
        setTableScope();
        setWriteFocus([]);
        updateSnapshotPath(snapshotId, activeTable.id.wsId);
      }

      // if (mode === 'record' && recordId) {
      //   if (columnId) {
      //     setColumnScope(recordId, columnId);
      //     setWriteFocus([{ recordWsId: recordId, columnWsId: columnId }]);
      //     updateSnapshotPath(snapshotId, activeTable.id.wsId, recordId, columnId);
      //   } else {
      //     setRecordScope(recordId);
      //     updateSnapshotPath(snapshotId, activeTable.id.wsId, recordId);
      //   }
      // }

      // if (mode === 'spreadsheet') {
      //   setTableScope();
      //   setWriteFocus([]);
      //   updateSnapshotPath(snapshotId, activeTable.id.wsId);
      // }
    },
    [
      activeTable,
      setColumnScope,
      setWriteFocus,
      updateSnapshotPath,
      snapshotId,
      setRecordScope,
      setTableScope,
      savePendingUpdates,
    ],
  );

  // const switchToRecordView = useCallback(
  //   async (recordId: string, columnId?: string) => {
  //     switchDisplayMode('record', recordId, columnId);
  //   },
  //   [switchDisplayMode],
  // );

  // const switchToSpreadsheetView = useCallback(async () => {
  //   switchDisplayMode('spreadsheet');
  // }, [switchDisplayMode]);

  // const switchToNewSpreadsheetView = useCallback(async () => {
  //   switchDisplayMode('new-spreadsheet');
  // }, [switchDisplayMode]);

  const value: TableContextValue = {
    activeTable,
    setActiveTable,
    // displayMode,
    activeRecord,
    // switchToRecordView,
    // switchToSpreadsheetView,
    // switchToNewSpreadsheetView,
    switchDisplayMode,
    addPendingChange,
    savePendingUpdates,
    pendingChanges,
    savingPendingChanges,
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
