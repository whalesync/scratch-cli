import { Snapshot, TableSpec } from '@/types/server-entities/snapshot';

export interface SnapshotTableGridProps {
  snapshot: Snapshot;
  table: TableSpec;
  limited?: boolean;
  // onSingleRowSelected?: (recordId: string | null) => void;
  // onCellDoubleClickTransition?: (recordId: string, columnId: string) => void;
}

type MenuItemHandlerProps = {
  disabled: true;
} | {
  disabled: boolean;
  handler: () => Promise<unknown>;
};

export type MenuItem = MenuItemHandlerProps & {
  label: string;
  leftSection?: React.ReactNode;
  group?: string;
  handler?: () => Promise<unknown>;
};

export type ContextMenu = {
  x: number;
  y: number;
};