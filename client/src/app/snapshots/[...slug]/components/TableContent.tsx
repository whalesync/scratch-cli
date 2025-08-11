import { useSnapshotContext } from '@/app/snapshots/[...slug]/SnapshotContext';
import { TableSpec } from '@/types/server-entities/snapshot';
import { useState } from 'react';
import { useFocusedCellsContext } from '../FocusedCellsContext';
import { useSnapshotParams } from '../hooks/use-snapshot-params';
import { RecordView } from './RecordView';
import SnapshotTableGrid from './snapshot-table/SnapshotTableGrid';

interface TableContentProps {
  table: TableSpec;
  currentViewId: string | null;
  filterToView: boolean;
}

interface ActiveRecord {
  recordId: string | undefined;
  columnId: string | undefined;
}

export const TableContent = ({ table, currentViewId, filterToView }: TableContentProps) => {
  const {
    snapshotId,
    recordId: recordIdParam,
    columnId: columnIdParam,
    updateSnapshotPath,
    pushSnapshotPath,
  } = useSnapshotParams();
  const { snapshot } = useSnapshotContext();
  const { setWriteFocus, setTableScope, setColumnScope, setRecordScope } = useFocusedCellsContext();
  const [currentView, setCurrentView] = useState<string | null>(recordIdParam ? 'record' : 'spreadsheet');
  const [currentRecord, setCurrentRecord] = useState<ActiveRecord>({
    recordId: recordIdParam,
    columnId: columnIdParam,
  });

  const handleSwitchView = (view: 'spreadsheet' | 'record', recordId?: string, columnId?: string) => {
    setCurrentView(view);
    setCurrentRecord({ recordId, columnId });

    if (view === 'record' && recordId) {
      if (columnId) {
        setColumnScope(recordId, columnId);
        setWriteFocus([{ recordWsId: recordId, columnWsId: columnId }]);
        updateSnapshotPath(snapshotId, table.id.wsId, recordId, columnId);
      } else {
        setRecordScope(recordId);
        updateSnapshotPath(snapshotId, table.id.wsId, recordId);
      }
    }

    if (view === 'spreadsheet') {
      setTableScope();
      setWriteFocus([]);
      pushSnapshotPath(snapshotId, table.id.wsId);
    }
  };

  if (!snapshot) {
    return null; // or a loading state
  }

  if (currentView === 'spreadsheet') {
    return (
      <SnapshotTableGrid
        snapshot={snapshot}
        table={table}
        currentViewId={currentViewId}
        onSwitchToRecordView={(recordId: string, columnId?: string) => handleSwitchView('record', recordId, columnId)}
        filterToView={filterToView}
      />
    );
  } else {
    return (
      <RecordView
        table={table}
        onSwitchToSpreadsheetView={() => handleSwitchView('spreadsheet')}
        initialColumnId={currentRecord.columnId}
        initialRecordId={currentRecord.recordId}
        filterToView={filterToView}
      />
    );
  }
};
