'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Table, Button, Popover, TextInput, Group, Stack } from '@mantine/core';

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

const columnHelper = createColumnHelper<DataRecord>();

export default function RecordsGrid({
  records,
  onUpdate,
  onDelete,
}: RecordsGridProps) {
  const [editingRow, setEditingRow] = useState<DataRecord | null>(null);
  const [editingData, setEditingData] = useState<Record<string, unknown>>({});

  // Get all unique field names from all records
  const allFields = useMemo(() => {
    const fields = new Set<string>();
    records.forEach(record => {
      Object.keys(record.remote).forEach(field => fields.add(field));
      if (record.staged) {
        Object.keys(record.staged).forEach(field => fields.add(field));
      }
      if (record.suggested) {
        Object.keys(record.suggested).forEach(field => fields.add(field));
      }
    });
    return Array.from(fields).sort();
  }, [records]);

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: () => 'ID',
        cell: (info) => info.getValue(),
      }),
      ...allFields.map(field =>
        columnHelper.accessor(
          (row) => {
            const { remote, staged, suggested } = row;
            
            // Case 1: Staged is marked for deletion
            if (staged === null) {
              return (
                <div style={{ color: 'red', textDecoration: 'line-through' }}>
                  {String(remote[field] || '')}
                </div>
              );
            }

            const currentValue = staged ? staged[field] : remote[field];
            const isStagedDifferent = staged && remote[field] !== staged[field];
            const isSuggestedDifferent = suggested && 
              (!staged || suggested[field] !== staged[field]) && 
              suggested[field] !== remote[field];

            return (
              <div>
                <div style={{ 
                  color: isStagedDifferent ? 'blue' : 'inherit',
                  fontWeight: isStagedDifferent ? 'bold' : 'normal'
                }}>
                  {String(currentValue || '')}
                </div>
                {isSuggestedDifferent && (
                  <div style={{ 
                    color: 'orange', 
                    fontSize: '0.8em',
                    fontStyle: 'italic'
                  }}>
                    ✨ {String(suggested[field] || '')}
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
        id: 'actions',
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
                setEditingData({});
              }}
            >
              <Popover.Target>
                <Button size="xs" onClick={() => {
                  setEditingRow(row.original);
                  setEditingData(row.original.staged || row.original.remote);
                }}>
                  Edit
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onUpdate(row.original.id, editingData);
                    setEditingRow(null);
                    setEditingData({});
                  }}
                >
                  <Stack gap="sm">
                    {allFields.map(field => (
                      <TextInput
                        key={field}
                        label={field}
                        name={field}
                        value={String(editingData[field] || '')}
                        onChange={(e) => setEditingData(prev => ({
                          ...prev,
                          [field]: e.target.value
                        }))}
                      />
                    ))}
                    <Button type="submit" mt="sm">
                      Save
                    </Button>
                  </Stack>
                </form>
              </Popover.Dropdown>
            </Popover>
            {row.original.suggested && (
              <Button 
                size="xs" 
                variant="light"
                onClick={() => onUpdate(row.original.id, row.original.suggested!)}
              >
                ✨ Accept
              </Button>
            )}
            <Button size="xs" color="red" onClick={() => onDelete(row.original.id)}>
              Delete
            </Button>
          </Group>
        ),
      }),
    ],
    [editingRow, editingData, onUpdate, onDelete, allFields]
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
                      header.getContext(),
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