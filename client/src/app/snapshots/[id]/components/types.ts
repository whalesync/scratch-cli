import {Snapshot, TableSpec} from '@/types/server-entities/snapshot';
export interface FocusedCell {
  recordWsId: string;
  columnWsId: string;
}

export interface SnapshotTableGridProps {
  snapshot: Snapshot;
  table: TableSpec;
  currentViewId?: string | null;
  onSwitchToRecordView: (recordId: string, columnId?: string) => void;
  filterToView: boolean;
}

export type MenuItem = {
  label: string;
  disabled: boolean;
  leftSection?: React.ReactNode;
  group?: string;
  handler?: () => Promise<unknown>;
};