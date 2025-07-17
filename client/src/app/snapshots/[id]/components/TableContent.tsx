import { Snapshot, TableSpec } from '@/types/server-entities/snapshot';
import { useState } from 'react';
import { RecordView } from './RecordView';
import SnapshotTableGrid from './SnapshotTableGrid';

interface FocusedCell {
  recordWsId: string;
  columnWsId: string;
}

interface TableContentProps {
  snapshot: Snapshot;
  table: TableSpec;
  currentViewId?: string | null;
  onViewCreated?: (viewId: string) => void;
  onFocusedCellsChange?: (readFocus: FocusedCell[], writeFocus: FocusedCell[]) => void;
}

interface ActiveRecord {
  recordId: string | undefined;
  columnId: string | undefined;
}

export const TableContent = ({
  snapshot,
  table,
  currentViewId,
  onViewCreated,
  onFocusedCellsChange,
}: TableContentProps) => {
  const [currentView, setCurrentView] = useState<string | null>('spreadsheet');
  const [currentRecord, setCurrentRecord] = useState<ActiveRecord>({ recordId: undefined, columnId: undefined });

  const handleSwitchView = (view: 'spreadsheet' | 'record', recordId?: string, columnId?: string) => {
    setCurrentView(view);
    setCurrentRecord({ recordId, columnId });
  };

  if (currentView === 'spreadsheet') {
    return (
      <SnapshotTableGrid
        snapshot={snapshot}
        table={table}
        currentViewId={currentViewId}
        onSwitchToRecordView={(recordId: string, columnId?: string) => handleSwitchView('record', recordId, columnId)}
        onViewCreated={onViewCreated}
        onFocusedCellsChange={onFocusedCellsChange}
      />
    );
  } else {
    return (
      <RecordView
        snapshot={snapshot}
        table={table}
        onSwitchToSpreadsheetView={() => handleSwitchView('spreadsheet')}
        initialColumnId={currentRecord.columnId}
        initialRecordId={currentRecord.recordId}
      />
    );
  }
};
