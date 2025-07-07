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
import {
  ColumnSpec,
  Snapshot,
  TableSpec,
} from "@/types/server-entities/snapshot";
import {
  ActionIcon,
  Box,
  Center,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
  useModalsStack,
} from "@mantine/core";
import {
  useSnapshotRecords,
  useSnapshotViews,
} from "../../../hooks/use-snapshot";
import { BulkUpdateRecordsDto } from "@/types/server-entities/records";
import { BugIcon, PlusIcon, SlidersIcon } from "@phosphor-icons/react";
import JsonTreeViewer from "../../components/JsonTreeViewer";
import { notifications } from "@mantine/notifications";
import { AnimatedArrowsClockwise } from "@/app/components/AnimatedArrowsClockwise";

interface SnapshotTableGridProps {
  snapshot: Snapshot;
  table: TableSpec;
}

type SortDirection = "asc" | "desc";

interface SortState {
  columnId: string;
  dir: SortDirection;
}

const generatePendingId = (): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "ws_pending_";
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const FAKE_LEFT_COLUMNS = 2;

const SnapshotTableGrid = ({ snapshot, table }: SnapshotTableGridProps) => {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [sort, setSort] = useState<SortState | undefined>();
  const [hoveredRow, setHoveredRow] = useState<number | undefined>();

  const modalStack = useModalsStack(["tableSpecDebug", "tableContextDebug"]);

  const tableContext = snapshot.tableContexts.find(
    (c) => c.id.wsId === table.id.wsId
  );

  const {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    views,
  } = useSnapshotViews({
    snapshotId: snapshot.id,
    tableId: table.id.wsId,
  });

  const activeView = views
    ? views.find((v) => v.id === tableContext?.activeViewId)
    : undefined;

  const { recordsResponse, isLoading, error, bulkUpdateRecords } =
    useSnapshotRecords({
      snapshotId: snapshot.id,
      tableId: table.id.wsId,
      activeView: activeView,
    });

  const sortedRecords = useMemo(() => {
    console.log("Evaluating sortedRecords", recordsResponse?.records);

    if (!recordsResponse?.records) return undefined;

    if (!sort) {
      // sort filtered last
      return recordsResponse.records.sort((a, b) => {
        if (a.filtered && !b.filtered) return 1;
        if (!a.filtered && b.filtered) return -1;
        return 0;
      });
    }

    const { columnId, dir } = sort;

    const sortedOthers = recordsResponse.records.sort((a, b) => {
      const aVal = a.fields[columnId];
      const bVal = b.fields[columnId];

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

    // resort by filtered last
    return sortedOthers.sort((a, b) => {
      if (a.filtered && !b.filtered) return 1;
      if (!a.filtered && b.filtered) return -1;
      return 0;
    });
  }, [recordsResponse?.records, sort]);

  const onCellClicked = useCallback(
    (cell: Item) => {
      const [col, row] = cell;
      if (col === 0) {
        // Actions column
        const record = sortedRecords?.[row];
        if (!record) return;
        try {
          bulkUpdateRecords({
            ops: [{ op: "delete", wsId: record.id.wsId }],
          });
        } catch (e) {
          const error = e as Error;
          notifications.show({
            title: "Error deleting record",
            message: error.message,
            color: "red",
          });
        }
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
      const isFiltered = record?.filtered;

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

      if (col === 1) {
        return {
          kind: GridCellKind.Text,
          data: record?.id.remoteId ?? "",
          displayData: record?.id.remoteId ?? "",
          readonly: true,
          allowOverlay: false,
        };
      }

      const column = table.columns[col - FAKE_LEFT_COLUMNS];
      const value = record?.fields[column.id.wsId];
      const isReadonly = !!column.readonly;

      const themeOverride: Partial<Theme> = {};
      if (isDeleted) {
        themeOverride.bgCell = "#fde0e0";
      } else if (editedFields?.__created) {
        themeOverride.bgCell = "#e0fde0";
      } else if (editedFields?.[column.id.wsId]) {
        themeOverride.bgCell = "#fdfde0";
      }
      if (isFiltered) {
        themeOverride.textDark = "#cacaca";
      }

      if (
        column.id.wsId === "id" &&
        typeof value === "string" &&
        value.startsWith("ws_pending_")
      ) {
        return {
          kind: GridCellKind.Text,
          data: value,
          displayData: "new",
          allowOverlay: false,
          readonly: true,
          themeOverride: {
            textDark: "darkgray",
            ...themeOverride,
          },
        };
      }

      return {
        kind: GridCellKind.Text,
        allowOverlay: !isReadonly,
        readonly: isReadonly,
        displayData: value ? String(value) : "",
        data: value ? String(value) : "",
        themeOverride,
      };
    },
    [sortedRecords, table.columns, hoveredRow]
  );

  const onAddRow = useCallback(() => {
    const newRecordId = generatePendingId();

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
          wsId: newRecordId,
          data: newRecordData,
        },
      ],
    };
    try {
      bulkUpdateRecords(dto);
    } catch (e) {
      const error = e as Error;
      notifications.show({
        title: "Error creating record",
        message: error.message,
        color: "red",
      });
    }
  }, [bulkUpdateRecords, table.columns]);

  const onCellEdited = useCallback(
    async (cell: Item, newValue: EditableGridCell) => {
      if (newValue.kind !== GridCellKind.Text) {
        return;
      }

      const [col, row] = cell;
      const record = sortedRecords?.[row];
      if (!record) {
        return;
      }
      const column = table.columns[col - FAKE_LEFT_COLUMNS];
      const columnId = column.id.wsId;
      const recordId = record.id.wsId;

      const dto: BulkUpdateRecordsDto = {
        ops: [
          {
            op: "update",
            wsId: recordId,
            data: {
              [columnId]: newValue.data,
            },
          },
        ],
      };
      try {
        await bulkUpdateRecords(dto);
      } catch (e) {
        const error = e as Error;
        notifications.show({
          title: "Error updating record",
          message: error.message,
          color: "red",
        });
      }
    },
    [bulkUpdateRecords, sortedRecords, table.columns]
  );

  const onHeaderClicked = useCallback(
    (colIndex: number) => {
      if (colIndex === 0) return;
      const column = table.columns[colIndex - FAKE_LEFT_COLUMNS];
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
      ...(c.readonly && {
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
      {
        title: "ID",
        id: "id",
        width: 150,
        themeOverride: { bgCell: "#F7F7F7" },
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
    <>
      <Modal
        {...modalStack.register("tableSpecDebug")}
        title={`TableSpec for ${table.name}`}
        size="lg"
      >
        <ScrollArea h={500}>
          <JsonTreeViewer jsonData={table} />
        </ScrollArea>
      </Modal>
      <Modal
        {...modalStack.register("tableContextDebug")}
        title={`Table Context settings for ${table.name}`}
        size="lg"
      >
        <ScrollArea h={500}>
          <JsonTreeViewer jsonData={tableContext ?? {}} />
        </ScrollArea>
      </Modal>
      <Box h="100%" w="100%" style={{ position: "relative" }}>
        <Stack p={0} h="100%" gap={0}>
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
            getCellsForSelection={true}
            onPaste={true}
            onItemHovered={(args: GridMouseEventArgs) => {
              if (args.kind === "cell") {
                setHoveredRow(args.location[1]);
              } else {
                setHoveredRow(undefined);
              }
            }}
          />
          <Group w="100%" p="xs" bg="gray.0">
            {isLoading ? (
              <AnimatedArrowsClockwise size={24} />
            ) : (
              <Text size="sm">{sortedRecords?.length ?? 0} records</Text>
            )}
            <Group gap="xs" ml="auto" p={0}>
              <Tooltip label="View JSON data">
                <ActionIcon
                  onClick={() => modalStack.open("tableSpecDebug")}
                  size="lg"
                  radius="xl"
                  variant="filled"
                  color="violet"
                >
                  <BugIcon size={24} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="View Table Context data">
                <ActionIcon
                  onClick={() => modalStack.open("tableContextDebug")}
                  size="lg"
                  radius="xl"
                  variant="filled"
                  color="gray"
                >
                  <SlidersIcon size={24} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Add record">
                <ActionIcon
                  onClick={onAddRow}
                  size="lg"
                  radius="xl"
                  variant="filled"
                >
                  <PlusIcon size={24} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </Stack>
      </Box>
    </>
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
