'use client';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { CsvPreviewResponse, uploadsApi } from '@/lib/api/uploads';
import { PostgresColumnType } from '@/types/server-entities/snapshot';
import { getColumnTypeIcon } from '@/utils/columns';
import {
  Button,
  Checkbox,
  ComboboxData,
  Group,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

// Custom type for modal that includes IGNORE option
type ModalColumnType = PostgresColumnType | 'IGNORE';

interface CsvPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  data: CsvPreviewResponse | null;
  fileName?: string;
  file: File | null;
}

// Function to get icon for modal column type (includes IGNORE)
const getModalColumnTypeIcon = (type: ModalColumnType) => {
  if (type === 'IGNORE') {
    return <StyledLucideIcon Icon={X} size={14} c="#ff0000" />;
  }
  return getColumnTypeIcon(type as PostgresColumnType);
};

export const CsvPreviewModal = ({ opened, onClose, data, fileName, file }: CsvPreviewModalProps) => {
  const [firstRowIsHeader, setFirstRowIsHeader] = useState(true);
  const [columnNames, setColumnNames] = useState<string[]>([]);
  const [columnTypes, setColumnTypes] = useState<ModalColumnType[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [scratchpaperName, setScratchpaperName] = useState('');

  // Initialize column names and types when data changes
  useEffect(() => {
    if (data && data.rows.length > 0) {
      const firstRow = data.rows[0];
      const numColumns = firstRow.length;

      if (firstRowIsHeader) {
        // Use first row as column names
        setColumnNames([...firstRow]);
      } else {
        // Use default column names
        setColumnNames(Array.from({ length: numColumns }, (_, i) => `Column ${i + 1}`));
      }

      // Initialize column types as text (default) - only when data changes, not when checkbox changes
      setColumnTypes(Array.from({ length: numColumns }, () => PostgresColumnType.TEXT));
    }
  }, [data, firstRowIsHeader]); // Removed firstRowIsHeader from dependencies

  // Initialize scratchpaper name from filename
  useEffect(() => {
    if (fileName) {
      const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');
      setScratchpaperName(nameWithoutExtension);
    }
  }, [fileName]);

  // Update column names when checkbox changes
  useEffect(() => {
    if (data && data.rows.length > 0) {
      const firstRow = data.rows[0];
      const numColumns = firstRow.length;

      if (firstRowIsHeader) {
        setColumnNames([...firstRow]);
      } else {
        setColumnNames(Array.from({ length: numColumns }, (_, i) => `Column ${i + 1}`));
      }
    }
  }, [firstRowIsHeader, data]);

  const handleColumnNameChange = (index: number, value: string) => {
    const newColumnNames = [...columnNames];
    newColumnNames[index] = value;
    setColumnNames(newColumnNames);
  };

  const handleColumnTypeChange = (index: number, value: string) => {
    const newColumnTypes = [...columnTypes];
    newColumnTypes[index] = value as ModalColumnType;
    setColumnTypes(newColumnTypes);
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    try {
      // Filter out IGNORE columns before sending to server
      const filteredData = columnNames
        .map((name, index) => ({ name, type: columnTypes[index], index }))
        .filter(({ type }) => type !== 'IGNORE');

      const filteredColumnNames = filteredData.map(({ name }) => name);
      const filteredColumnTypes = filteredData.map(({ type }) => type as PostgresColumnType);

      const result = await uploadsApi.importCsv({
        file,
        scratchpaperName,
        columnNames: filteredColumnNames,
        columnTypes: filteredColumnTypes,
        firstRowIsHeader,
      });

      console.log('CSV imported successfully:', result);
      // Success - close modal
      onClose();
    } catch (error) {
      console.error('Import failed:', error);
      // Error handling could be improved with notifications
    } finally {
      setIsImporting(false);
    }
  };

  if (!data || data.rows.length === 0) return null;

  const { rows } = data;
  // When firstRowIsHeader is true: show rows 1 to N (skip first row, show all data rows)
  // When firstRowIsHeader is false: show rows 0 to N-1 (ignore last row to maintain consistent preview)
  const displayRows = firstRowIsHeader ? rows.slice(1) : rows.slice(0, -1);

  return (
    <>
      <style jsx>{`
        :global(.custom-select-dropdown) {
          width: 150px !important;
        }
      `}</style>
      <Modal
        opened={opened}
        onClose={onClose}
        title={<Title order={3}>Preview: Create Scratchpaper from CSV</Title>}
        size="80%"
        centered
      >
        <Stack gap="xl">
          {/* Filename display */}
          <Text size="sm" fw={500}>
            File name: {fileName}
          </Text>

          {/* Header checkbox */}
          <Checkbox
            checked={firstRowIsHeader}
            onChange={(event) => setFirstRowIsHeader(event.currentTarget.checked)}
            label="First row is a header"
          />

          {/* Combined header table with column types and names */}
          <div
            style={{
              maxHeight: '400px',
              overflow: 'auto',
            }}
          >
            <Table highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                {/* Combined column type and name row */}
                <Table.Tr>
                  {columnNames.map((name, index) => (
                    <Table.Th
                      key={`header-${index}`}
                      style={{
                        padding: '4px',
                        backgroundColor: 'black',
                        borderBottom: '2px solid #dee2e6',
                        minWidth: '100px',
                        maxWidth: '200px',
                        width: '150px',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      <Group gap={2} align="center" wrap="nowrap" style={{ width: '100%' }}>
                        {/* Column name input */}
                        <TextInput
                          value={name}
                          onChange={(event) => handleColumnNameChange(index, event.currentTarget.value)}
                          size="xs"
                          style={{ flex: 1, minWidth: 0 }}
                          styles={{
                            input: {
                              border: 'none',
                              backgroundColor: 'transparent',
                              padding: '2px 4px',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                            },
                          }}
                        />
                        {/* Type selector with icon in dropdown only */}
                        <Select
                          value={columnTypes[index]}
                          onChange={(value) => value && handleColumnTypeChange(index, value)}
                          data={[
                            ...Object.values(PostgresColumnType).map((type) => ({
                              value: type,
                              label: type,
                              leftSection: getColumnTypeIcon(type),
                            })),
                            {
                              value: 'IGNORE',
                              label: 'ignore',
                              leftSection: <StyledLucideIcon Icon={X} size={14} c="#ff0000" />,
                            } as ComboboxData[0],
                          ]}
                          size="xs"
                          renderOption={(option) => (
                            <Group>
                              {getModalColumnTypeIcon(option.option.value as ModalColumnType)} {option.option.label}
                            </Group>
                          )}
                          w={50}
                          styles={{
                            input: {
                              border: 'none',
                              backgroundColor: 'transparent',
                              padding: '2px 4px',
                              color: 'transparent', // Hide the text
                            },
                          }}
                          classNames={{
                            dropdown: 'custom-select-dropdown',
                          }}
                          leftSection={getModalColumnTypeIcon(columnTypes[index])}
                        />
                      </Group>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              {/* Data rows */}
              <Table.Tbody>
                {displayRows.map((row, rowIndex) => (
                  <Table.Tr key={rowIndex}>
                    {columnNames.map((_, colIndex) => (
                      <Table.Td
                        key={colIndex}
                        style={{
                          minWidth: '140px',
                          maxWidth: '200px',
                          width: '150px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {row[colIndex] || ''}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>

          {/* Import section */}
          <Group align="center">
            <Text size="sm" fw={500} style={{ minWidth: '120px' }}>
              Scratchpaper name
            </Text>
            <TextInput
              value={scratchpaperName}
              onChange={(event) => setScratchpaperName(event.currentTarget.value)}
              placeholder="Enter scratchpaper name"
              style={{ flex: 1 }}
            />
            <Button onClick={handleImport} loading={isImporting} size="md">
              Import
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
};
