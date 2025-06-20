'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Table, Button, Popover, TextInput, Group } from '@mantine/core';

interface Record {
  id: string;
  remote: { title: string };
  staged: { title: string } | null | undefined;
  suggested: { title: string } | null | undefined;
}

interface RecordsGridProps {
  records: Record[];
  onUpdate: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

const columnHelper = createColumnHelper<Record>();

export default function RecordsGrid({
  records,
  onUpdate,
  onDelete,
}: RecordsGridProps) {
  const [editingRow, setEditingRow] = useState<Record | null>(null);

  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: () => 'ID',
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor('staged.title', {
        header: () => 'Title',
        cell: (info) => {
          const { remote, staged, suggested } = info.row.original;

          // Case 1: Staged is marked for deletion
          if (staged === null) {
            return (
              <div style={{ color: 'red', textDecoration: 'line-through' }}>
                {remote.title}
              </div>
            );
          }

          const isStagedDifferent = staged && remote.title !== staged.title;
          const isSuggestedDifferent = suggested && (!staged || suggested.title !== staged.title) && suggested.title !== remote.title;

          // Case 2: Default rendering logic
          return (
            <div>
              <div style={{ 
                fontWeight: isStagedDifferent ? 'normal' : 'bold', 
                color: 'black', 
                textDecoration: isStagedDifferent ? 'line-through' : 'none' 
              }}>
                {remote.title}
              </div>
              {isStagedDifferent && staged && (
                <div style={{ color: 'green' }}>
                  {staged.title}
                </div>
              )}
              {/* Also check if suggested is null (for deletion) */}
              {suggested === null && (
                 <div style={{ color: 'red', textDecoration: 'line-through', fontStyle: 'italic' }}>
                   {staged?.title || remote.title}
                 </div>
              )}
              {isSuggestedDifferent && suggested && (
                <div style={{ color: 'gray', fontStyle: 'italic' }}>
                  {suggested.title}
                </div>
              )}
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        cell: ({ row }) => (
          <Group>
            <Popover
              width={300}
              trapFocus
              position="bottom"
              withArrow
              shadow="md"
              opened={editingRow?.id === row.original.id}
              onClose={() => setEditingRow(null)}
            >
              <Popover.Target>
                <Button size="xs" onClick={() => setEditingRow(row.original)}>
                  Edit
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const newTitle = formData.get('title') as string;
                    onUpdate(row.original.id, newTitle);
                    setEditingRow(null);
                  }}
                >
                  <TextInput
                    label="Edit Title"
                    name="title"
                    defaultValue={row.original.staged?.title ?? row.original.remote.title}
                    autoFocus
                  />
                  <Button type="submit" mt="sm">
                    Save
                  </Button>
                </form>
              </Popover.Dropdown>
            </Popover>
            <Button size="xs" color="red" onClick={() => onDelete(row.original.id)}>
              Delete
            </Button>
          </Group>
        ),
      }),
    ],
    [editingRow, onUpdate, onDelete]
  );

  const table = useReactTable({
    data: records,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <Table striped highlightOnHover withTableBorder withColumnBorders>
      <Table.Thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <Table.Th key={header.id}>
                {flexRender(
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