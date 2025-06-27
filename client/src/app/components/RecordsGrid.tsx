"use client";

import { useMemo, useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { Table, Button, Popover, TextInput, Group, Stack } from "@mantine/core";
import React from "react";

interface DataRecord {
  id: string;
  remote: Record<string, unknown>;
  staged: Record<string, unknown> | null | undefined;
  suggested: Record<string, unknown> | null | undefined;
}

interface RecordsGridProps {
  records: DataRecord[];
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}

// Separate component for the edit form to prevent re-rendering issues
const EditForm = React.memo(
  ({
    record,
    fields,
    onSave,
    onCancel,
  }: {
    record: DataRecord;
    fields: string[];
    onSave: (data: Record<string, unknown>) => void;
    onCancel: () => void;
  }) => {
    const [formData, setFormData] = useState<Record<string, unknown>>(
      record.staged || record.remote
    );

    const handleFieldChange = (field: string, value: string) => {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave(formData);
    };

    return (
      <form onSubmit={handleSubmit}>
        <Stack gap="sm">
          {fields.map((field) => (
            <TextInput
              key={`${record.id}-${field}`}
              label={field}
              name={field}
              value={String(formData[field] || "")}
              onChange={(e) => handleFieldChange(field, e.target.value)}
            />
          ))}
          <Group gap="sm">
            <Button type="submit" size="sm">
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      </form>
    );
  }
);

EditForm.displayName = "EditForm";

const columnHelper = createColumnHelper<DataRecord>();

/**
 * @deprecated This page is no longer used.
 */
export default function RecordsGrid({
  records,
  onUpdate,
  onDelete,
}: RecordsGridProps) {
  const [editingRow, setEditingRow] = useState<DataRecord | null>(null);

  // Get all unique field names from all records - memoized to prevent recreation
  const allFields = useMemo(() => {
    const fields = new Set<string>();
    records.forEach((record) => {
      Object.keys(record.remote).forEach((field) => fields.add(field));
      if (record.staged) {
        Object.keys(record.staged).forEach((field) => fields.add(field));
      }
      if (record.suggested) {
        Object.keys(record.suggested).forEach((field) => fields.add(field));
      }
    });
    return Array.from(fields).sort();
  }, [records]);

  const handleSave = useCallback(
    (data: Record<string, unknown>) => {
      if (editingRow) {
        onUpdate(editingRow.id, data);
      }
      setEditingRow(null);
    },
    [editingRow, onUpdate]
  );

  const handleCancel = useCallback(() => {
    setEditingRow(null);
  }, []);

  const columns = useMemo(
    () => [
      columnHelper.accessor("id", {
        header: () => "ID",
        cell: (info) => info.getValue(),
      }),
      ...allFields.map((field) =>
        columnHelper.accessor(
          (row) => {
            const { remote, staged, suggested } = row;

            // Case 1: Staged is marked for deletion
            if (staged === null) {
              return (
                <div style={{ color: "red", textDecoration: "line-through" }}>
                  {String(remote[field] || "")}
                </div>
              );
            }

            const isStagedDifferent = staged && remote[field] !== staged[field];
            const isSuggestedDifferent =
              suggested &&
              (!staged || suggested[field] !== staged[field]) &&
              suggested[field] !== remote[field];

            return (
              <div>
                {/* Show remote value (crossed out if staged is different) */}
                <div
                  style={{
                    fontWeight: "normal",
                    color: "black",
                    textDecoration: isStagedDifferent ? "line-through" : "none",
                  }}
                >
                  {String(remote[field] || "")}
                </div>
                {/* Show staged value if different from remote */}
                {isStagedDifferent && staged && (
                  <div style={{ color: "green" }}>
                    {String(staged[field] || "")}
                  </div>
                )}
                {/* Show suggested value if different */}
                {isSuggestedDifferent && (
                  <div
                    style={{
                      color: "gray",
                      fontStyle: "italic",
                    }}
                  >
                    ✨ {String(suggested[field] || "")}
                  </div>
                )}
              </div>
            );
          },
          {
            id: field,
            header: () => field,
            cell: (info) => info.getValue(),
          }
        )
      ),
      columnHelper.display({
        id: "actions",
        cell: ({ row }) => (
          <Group>
            <Popover
              width={400}
              trapFocus
              position="bottom"
              withArrow
              shadow="md"
              opened={editingRow?.id === row.original.id}
              onClose={() => {
                setEditingRow(null);
              }}
            >
              <Popover.Target>
                <Button
                  size="xs"
                  onClick={() => {
                    setEditingRow(row.original);
                  }}
                >
                  Edit
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <EditForm
                  record={row.original}
                  fields={allFields}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              </Popover.Dropdown>
            </Popover>
            {row.original.suggested && (
              <Button
                size="xs"
                variant="light"
                onClick={() =>
                  onUpdate(row.original.id, row.original.suggested!)
                }
              >
                ✨ Accept
              </Button>
            )}
            <Button
              size="xs"
              color="red"
              onClick={() => onDelete(row.original.id)}
            >
              Delete
            </Button>
          </Group>
        ),
      }),
    ],
    [allFields, editingRow?.id, handleSave, handleCancel, onUpdate, onDelete]
  );

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table>
      <Table.Thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <Table.Th key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </Table.Th>
            ))}
          </Table.Tr>
        ))}
      </Table.Thead>
      <Table.Tbody>
        {table.getRowModel().rows.map((row) => (
          <Table.Tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <Table.Td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
