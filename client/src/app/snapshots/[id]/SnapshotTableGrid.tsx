"use client";

import {
  DataEditor,
  EditableGridCell,
  GridCell,
  GridCellKind,
  GridColumn,
  GridMouseEventArgs,
  Item,
  Theme,
} from "@glideapps/glide-data-grid";
import { useCallback, useMemo, useState } from "react";
import { ColumnSpec, TableSpec } from "@/types/server-entities/snapshot";
import { ActionIcon, Box, Center, Loader, Text } from "@mantine/core";
import { useSnapshotRecords } from "../../../hooks/use-snapshot";
import { BulkUpdateRecordsDto } from "@/types/server-entities/records";
import { Plus } from "@phosphor-icons/react";

interface SnapshotTableGridProps {
  snapshotId: string;
  table: TableSpec;
}

type SortDirection = "asc" | "desc";

interface SortState {
  columnId: string;
  dir: SortDirection;
}

const SnapshotTableGrid = ({ snapshotId, table }: SnapshotTableGridProps) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<SortState | undefined>();
  const [hoveredRow, setHoveredRow] = useState<number | undefined>();

  const { recordsResponse, isLoading, error, bulkUpdateRecords } =
    useSnapshotRecords(snapshotId, table.id.wsId);

  const sortedRecords = useMemo(() => {
    if (!recordsResponse?.records) return undefined;

    const createdRecords = recordsResponse.records.filter(
      (r) => r.__edited_fields?.__created
    );
    const otherRecords = recordsResponse.records.filter(
      (r) => !r.__edited_fields?.__created
    );

    if (!sort) {
      return [...createdRecords, ...otherRecords];
    }

    const { columnId, dir } = sort;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sortedOthers = [...otherRecords].sort((a: any, b: any) => {
      const aVal = a[columnId];
      const bVal = b[columnId];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return -1;
      if (bVal === null || bVal === undefined) return 1;

      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();

      if (strA < strB) {
        return dir === "asc" ? -1 : 1;
      }
      if (strA > strB) {
        return dir === "asc" ? 1 : -1;
      }
      return 0;
    });
    return [...createdRecords, ...sortedOthers];
  }, [recordsResponse?.records, sort]);

  const onCellClicked = useCallback(
    (cell: Item) => {
      const [col, row] = cell;
      if (col === 0) {
        // Actions column
        const record = sortedRecords?.[row];
        if (!record) return;
        bulkUpdateRecords({
          ops: [{ op: "delete", id: record.id }],
        });
      }
    },
    [bulkUpdateRecords, sortedRecords]
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const record = sortedRecords?.[row];
      const editedFields = record?.__edited_fields;
      const isHovered = hoveredRow === row;
      const isDeleted = !!editedFields?.__deleted;

      if (col === 0) {
        if (!isHovered || isDeleted) {
          return {
            kind: GridCellKind.Text,
            data: "",
            displayData: "",
            allowOverlay: false,
            readonly: true,
            themeOverride: isDeleted ? { bgCell: "#fde0e0" } : undefined,
          };
        }
        return {
          kind: GridCellKind.Text,
          data: "🗑️",
          displayData: "🗑️",
          readonly: true,
          allowOverlay: false,
          themeOverride: { bgCell: "#fde0e0" },
          contentAlign: "center",
          cursor: "pointer",
        };
      }

      const column = table.columns[col - 1]; // Adjust index
      const value = record?.[column.id.wsId];
      const isIdColumn = column.id.wsId === "id";

      const themeOverride: Partial<Theme> = {};
      if (isDeleted) {
        themeOverride.bgCell = "#fde0e0";
      } else if (editedFields?.__created) {
        themeOverride.bgCell = "#e0fde0";
      } else if (editedFields?.[column.id.wsId]) {
        themeOverride.bgCell = "#fdfde0";
      }

      return {
        kind: GridCellKind.Text,
        allowOverlay: !isIdColumn,
        readonly: isIdColumn,
        displayData: value ? String(value) : "",
        data: value ? String(value) : "",
        themeOverride,
      };
    },
    [sortedRecords, table.columns, hoveredRow]
  );

  const onAddRow = useCallback(() => {
    const newRecordsCount =
      sortedRecords?.filter((r) => r.__edited_fields?.__created).length ?? 0;
    const nextId = newRecordsCount + 1;
    const newRecordId = `new-record-${String(nextId).padStart(5, "0")}`;

    const newRecordData: Record<string, unknown> = {
      id: newRecordId,
    };

    table.columns.forEach((c) => {
      if (c.id.wsId !== "id") {
        newRecordData[c.id.wsId] = null;
      }
    });

    const dto: BulkUpdateRecordsDto = {
      ops: [
        {
          op: "create",
          id: newRecordId,
          data: newRecordData,
        },
      ],
    };
    bulkUpdateRecords(dto);
  }, [bulkUpdateRecords, table.columns, sortedRecords]);

  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      if (newValue.kind !== GridCellKind.Text) {
        return;
      }

      const [col, row] = cell;
      const record = sortedRecords?.[row];
      if (!record) {
        return;
      }
      const column = table.columns[col - 1];
      const columnId = column.id.wsId;
      const recordId = record.id as string;

      const dto: BulkUpdateRecordsDto = {
        ops: [
          {
            op: "update",
            id: recordId,
            data: {
              [columnId]: newValue.data,
            },
          },
        ],
      };
      bulkUpdateRecords(dto);
    },
    [bulkUpdateRecords, sortedRecords, table.columns]
  );

  const onHeaderClicked = useCallback(
    (colIndex: number) => {
      if (colIndex === 0) return;
      const column = table.columns[colIndex - 1];
      const columnId = column.id.wsId;

      setSort((currentSort) => {
        if (currentSort?.columnId === columnId) {
          if (currentSort.dir === "desc") {
            return undefined;
          } else {
            return {
              ...currentSort,
              dir: "desc",
            };
          }
        }
        return { columnId, dir: "asc" };
      });
    },
    [table.columns]
  );

  const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
    if (column.id && column.id !== "actions") {
      setColumnWidths((prev) => ({ ...prev, [column.id as string]: newSize }));
    }
  }, []);

  const columns: GridColumn[] = useMemo(() => {
    const baseColumns: GridColumn[] = table.columns.map((c) => ({
      title: titleWithSort(c, sort),
      id: c.id.wsId,
      width: columnWidths[c.id.wsId] ?? 150,
      ...(c.id.wsId === "id" && {
        themeOverride: {
          bgCell: "#F7F7F7",
        },
      }),
    }));

    return [
      {
        id: "actions",
        title: "",
        width: 35,
      },
      ...baseColumns,
    ];
  }, [table.columns, sort, columnWidths]);

  if (error) {
    return (
      <Center h="100%">
        <Text c="red">Error loading records: {error.message}</Text>
      </Center>
    );
  }

  if (isLoading && !recordsResponse) {
    return (
      <Center h="100%">
        <Loader />
      </Center>
    );
  }

  return (
    <Box h="100%" w="100%" style={{ position: "relative" }}>
      <DataEditor
        width="100%"
        height="100%"
        columns={columns}
        rows={sortedRecords?.length ?? 0}
        getCellContent={getCellContent}
        onCellEdited={onCellEdited}
        onColumnResize={onColumnResize}
        onHeaderClicked={onHeaderClicked}
        onCellClicked={onCellClicked}
        onItemHovered={(args: GridMouseEventArgs) => {
          if (args.kind === "cell") {
            setHoveredRow(args.location[1]);
          } else {
            setHoveredRow(undefined);
          }
        }}
      />
      <ActionIcon
        onClick={onAddRow}
        size="xl"
        radius="xl"
        variant="filled"
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
        }}
      >
        <Plus size={24} />
      </ActionIcon>
    </Box>
  );
};

function titleWithSort(column: ColumnSpec, sort: SortState | undefined) {
  if (sort?.columnId !== column.id.wsId) {
    return column.name;
  }
  const icon = sort.dir === "asc" ? "🔼" : "🔽";
  return `${column.name} ${icon}`;
}

export default SnapshotTableGrid;
