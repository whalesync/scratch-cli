import { useSnapshotContext } from '@/app/snapshots/[id]/SnapshotContext';
import { TableSpec } from '@/types/server-entities/snapshot';
import { useState } from 'react';
import { useFocusedCellsContext } from '../FocusedCellsContext';
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
  const { snapshot } = useSnapshotContext();
  const { setWriteFocus } = useFocusedCellsContext();
  const [currentView, setCurrentView] = useState<string | null>('spreadsheet');
  const [currentRecord, setCurrentRecord] = useState<ActiveRecord>({ recordId: undefined, columnId: undefined });

  const handleSwitchView = (view: 'spreadsheet' | 'record', recordId?: string, columnId?: string) => {
    setCurrentView(view);
    setCurrentRecord({ recordId, columnId });

    if (view === 'record' && recordId && columnId) {
      setWriteFocus([{ recordWsId: recordId, columnWsId: columnId }]);
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
