'use client';

import { useCallback, useMemo } from 'react';
import {
  DataEditor,
  GridColumn,
  GridCell,
  Item,
  EditableGridCell,
  GridCellKind,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";

interface Record {
  id: string;
  remote: { title: string };
  staged: { title: string };
  suggested: { title: string | null };
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

    if (!record) {
      return {
        kind: GridCellKind.Text,
        allowOverlay: false,
        readonly: true,
        displayData: "",
        data: "",
      };
    }

    if (col === 0) {
      return {
        kind: GridCellKind.Text,
        allowOverlay: false,
        readonly: true,
        displayData: record.id,
        data: record.id,
      };
    } else if (col === 1) {
      return {
        kind: GridCellKind.Text,
        allowOverlay: true,
        readonly: false,
        displayData: record.staged.title,
        data: record.staged.title,
      };
    } else {
      return {
        kind: GridCellKind.Text,
        allowOverlay: false,
        readonly: true,
        displayData: "🗑️ Delete",
        data: "delete",
      };
    }
  }, [records]);

  const onCellEdited = useCallback((cell: Item, newValue: EditableGridCell) => {
    const [, row] = cell;
    const record = records[row];
    if (newValue.kind === GridCellKind.Text && record) {
      onUpdate(record.id, newValue.data);
    }
  }, [records, onUpdate]);


  const onCellClicked = useCallback((cell: Item) => {
    const [col, row] = cell;
    if (col === 2 && records[row]) {
      onDelete(records[row].id);
    }
  }, [records, onDelete]);

  const columns = useMemo((): GridColumn[] => [
    { title: "ID", width: 70 },
    { title: "Title", width: 600 },
    { title: "Actions", width: 100 },
  ], []);

  if (!records) {
    return <div>Loading...</div>;
  }

  return (
    <DataEditor
      width="100%"
      height="100vh"
      rows={records.length}
      columns={columns}
      getCellContent={getContent}
      onCellClicked={onCellClicked}
      onCellEdited={onCellEdited}
      isDraggable={false}
      rowMarkers="none"
      smoothScrollX
      smoothScrollY
      getCellsForSelection={true}
      rowHeight={34}
    />
  );
} 