'use client';

import { useCallback, useMemo } from 'react';
import {
  DataEditor,
  GridColumn,
  GridCell,
  Item,
  EditableGridCell,
  GridCellKind,
  TextCell,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";

interface Record {
  id: string;
  title: string;
}

interface RecordsGridProps {
  records: Record[];
  onUpdate: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export default function RecordsGrid({ records, onUpdate, onDelete }: RecordsGridProps) {
  const getContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const record = records[row];

    if (col === 0) {
      return {
        kind: GridCellKind.Text,
        allowOverlay: false,
        readonly: true,
        displayData: record.id,
        data: record.id,
      } as TextCell;
    } else if (col === 1) {
      return {
        kind: GridCellKind.Text,
        allowOverlay: true,
        readonly: false,
        displayData: record.title,
        data: record.title,
      } as TextCell;
    } else {
      return {
        kind: GridCellKind.Text,
        allowOverlay: false,
        readonly: true,
        displayData: "🗑️ Delete",
        data: "delete",
      } as TextCell;
    }
  }, [records]);

  const columns = useMemo((): GridColumn[] => [
    { title: "ID", width: 70 },
    { title: "Title", width: 600 },
    { title: "Actions", width: 100 },
  ], []);

  const onCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [, row] = cell;
    const record = records[row];
    if (newValue.kind === GridCellKind.Text) {
      onUpdate(record.id, newValue.data);
    }
  }, [records, onUpdate]);

  const onCellClicked = useCallback((cell: Item) => {
    const [col, row] = cell;
    if (col === 2) {
      onDelete(records[row].id);
    }
  }, [records, onDelete]);

  return (
    <DataEditor
      width="100%"
      height="100vh"
      rows={records.length}
      columns={columns}
      getCellContent={getContent}
      onCellEdited={onCellEdited}
      onCellClicked={onCellClicked}
      isDraggable={false}
      rowMarkers="none"
      smoothScrollX
      smoothScrollY
      getCellsForSelection={true}
    />
  );
} 