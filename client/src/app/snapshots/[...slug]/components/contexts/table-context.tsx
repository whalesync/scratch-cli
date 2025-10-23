import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { RecordOperation } from '@/types/server-entities/records';
import { SnapshotTable } from '@/types/server-entities/snapshot';
import { sleep } from '@/utils/helpers';
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useSnapshotParams } from '../../hooks/use-snapshot-params';
import { useSnapshotContext } from './SnapshotContext';

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
  activeTable: SnapshotTable | undefined;
  setActiveTable: (table: SnapshotTable | undefined) => void;
  // displayMode: DisplayMode;
  // switchToRecordView: (recordId: string, columnId?: string) => Promise<void>;
  // switchToSpreadsheetView: () => Promise<void>;
  // switchToNewSpreadsheetView: () => Promise<void>;
  // switchDisplayMode: (recordId?: string, columnId?: string) => Promise<void>;
  activeRecord: ActiveRecord | null;
  setActiveRecord: (activeRecord: ActiveRecord | null) => void;
  recordDetailsVisible: boolean;
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
  const { snapshotId, recordId: recordIdParam, columnId: columnIdParam } = useSnapshotParams();
  const { viewDataAsAgent, currentViewId } = useSnapshotContext();
  /** State */
  const [activeTable, setActiveTable] = useState<SnapshotTable | undefined>(undefined);
  // const [displayMode, setDisplayMode] = useState<DisplayMode>(recordIdParam ? 'record' : 'spreadsheet');
  const [activeRecord, setActiveRecord] = useState<ActiveRecord | null>(
    recordIdParam
      ? {
          recordId: recordIdParam,
          columnId: columnIdParam,
        }
      : null,
  );
  const [pendingChanges, setPendingChanges] = useState<PendingUpdate[]>([]);
  const [savingPendingChanges, setSavingPendingChanges] = useState(false);

  const { bulkUpdateRecords } = useSnapshotTableRecords({
    snapshotId: snapshotId,
    tableId: activeTable?.tableSpec.id.wsId ?? '',
    viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
  });

  /** API */

  const addPendingChange = useCallback(
    (update: PendingUpdate) => {
      console.debug('addPendingChange', update);
      setPendingChanges((currentPendingChanges) => {
        const existing = currentPendingChanges.findIndex(
          (candidate) => candidate.recordWsId === update.recordWsId && candidate.field === update.field,
        );
        if (existing !== -1) {
          // reset the value in the list
          const newPendingUpdates = [...currentPendingChanges];
          newPendingUpdates[existing] = { recordWsId: update.recordWsId, field: update.field, value: update.value };
          return newPendingUpdates;
        } else {
          return [
            ...currentPendingChanges,
            { recordWsId: update.recordWsId, field: update.field, value: update.value },
          ];
        }
      });
    },
    [], // Remove pendingChanges dependency to prevent unnecessary re-renders
  );

  const savePendingUpdates = useCallback(async () => {
    if (pendingChanges.length === 0) {
      return;
    }

    console.debug('savePendingUpdates for table', activeTable?.tableSpec.id.wsId, pendingChanges);

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
  }, [pendingChanges, bulkUpdateRecords, activeTable?.tableSpec.id.wsId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (activeRecord?.recordId && !savingPendingChanges) {
        savePendingUpdates();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [savePendingUpdates, activeRecord, savingPendingChanges]);

  const value: TableContextValue = {
    activeTable,
    setActiveTable,
    setActiveRecord,
    // displayMode,
    activeRecord,
    recordDetailsVisible: !!activeRecord?.recordId,
    // switchToRecordView,
    // switchToSpreadsheetView,
    // switchToNewSpreadsheetView,
    // switchDisplayMode,
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
