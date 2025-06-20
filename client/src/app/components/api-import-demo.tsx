/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// import { CoreBase, ExternalTable } from '@/lib/client/v1/entities';
// import ApiV1 from '@/lib/client/v1/methods';
// import { Notifications } from '@/utils/notifications';
import {
  DataEditor,
  EditableGridCell,
  GridCell,
  GridCellKind,
  GridColumn,
  GridSelection,
  Item,
} from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import { Box, Button, Group, Modal, Radio, Select, Stack, Table, Text, Textarea, Tooltip } from '@mantine/core';
import { ArrowRight, MagnifyingGlass, Question, Sparkle } from '@phosphor-icons/react';
import _ from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { CoreBase, ExternalTable } from './types';

export const ApiImport: FC<{ coreBase: CoreBase }> = (props) => {
  const { coreBase } = props;
  const { leftExternalBase, rightExternalBase } = coreBase;
  //     curl -X POST https://api.example.com/users \\
  // -H "Content-Type: application/json" \\
  // --data '{"limit":10}'
  const [curl, setCurl] = useState(`{
  "url": "https://jsonplaceholder.typicode.com/users",
  "params": {
    "method": "GET",
    "headers": {},
    "body": null
  }
}`);

  const [response, setResponse] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [selectedTable, setSelectedTable] = useState<ExternalTable | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [gridSelection, setGridSelection] = useState<GridSelection | undefined>();
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [selectedMatchField, setSelectedMatchField] = useState<string>('');
  const [pathModalOpened, setPathModalOpened] = useState(false);
  const [currentField, setCurrentField] = useState<string>('');
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [result, setResult] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{
    created: number;
    updated: number;
    failed: number;
  } | null>(null);

  // State for record array path selection
  const [recordArrayPath, setRecordArrayPath] = useState<string>('');
  const [recordArrayPathModalOpened, setRecordArrayPathModalOpened] = useState(false);
  const [availableArrayPaths, setAvailableArrayPaths] = useState<string[]>([]);

  const externalBase = useMemo(() => {
    return side === 'left' ? leftExternalBase : rightExternalBase;
  }, [side, leftExternalBase, rightExternalBase]);

  // Initialize field mappings when table changes
  useEffect(() => {
    if (selectedTable) {
      const initialMappings: Record<string, string> = {};
      selectedTable.externalColumns?.forEach((column) => {
        initialMappings[column.name] = '';
      });
      setFieldMappings(initialMappings);
      setSelectedMatchField(''); // Reset match field selection
    } else {
      setFieldMappings({});
      setSelectedMatchField('');
    }
  }, [selectedTable]);

  // Function to extract all possible paths from an object
  const extractPaths = useCallback((obj: any, prefix = ''): string[] => {
    const paths: string[] = [];

    if (Array.isArray(obj) && obj.length > 0) {
      // For arrays, use the first item as template
      const firstItem = obj[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
        paths.push(...extractPaths(firstItem, prefix));
      } else {
        paths.push(prefix || '[0]');
      }
    } else if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach((key) => {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (typeof value === 'object' && value !== null) {
          paths.push(...extractPaths(value, newPrefix));
        } else {
          paths.push(newPrefix);
        }
      });
    }

    return paths;
  }, []);

  // Update available paths when response changes
  useEffect(() => {
    if (response && response.length > 0) {
      const paths = extractPaths(response[0]);

      // Sort paths hierarchically with leaf fields first at each level
      const sortedPaths = paths.sort((a, b) => {
        const aParts = a.split('.');
        const bParts = b.split('.');

        // Compare each level of the path
        const maxLength = Math.max(aParts.length, bParts.length);

        for (let i = 0; i < maxLength; i++) {
          const aPart = aParts[i] || '';
          const bPart = bParts[i] || '';

          if (aPart !== bPart) {
            // If one path is shorter (parent), it comes first
            if (!aPart) return -1;
            if (!bPart) return 1;

            // At this level, check if either field has children
            const aPrefix = aParts.slice(0, i + 1).join('.');
            const bPrefix = bParts.slice(0, i + 1).join('.');

            const aHasChildren = paths.some((path) => path.startsWith(aPrefix + '.') && path !== a);
            const bHasChildren = paths.some((path) => path.startsWith(bPrefix + '.') && path !== b);

            // If one has children and other doesn't, leaf field comes first
            if (aHasChildren !== bHasChildren) {
              return aHasChildren ? 1 : -1;
            }

            // Otherwise sort alphabetically at this level
            return aPart.localeCompare(bPart);
          }
        }

        // If all parts are equal up to this point, shorter path comes first
        return aParts.length - bParts.length;
      });
      setAvailablePaths(sortedPaths);
    } else {
      setAvailablePaths([]);
    }
  }, [response, extractPaths]);

  // Function to extract all possible array paths from an object
  const extractArrayPaths = useCallback((obj: any, prefix = ''): string[] => {
    const paths: string[] = [];

    if (Array.isArray(obj)) {
      // If current object is an array, add the current path
      paths.push(prefix || 'root');
    } else if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach((key) => {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (Array.isArray(value)) {
          // Found an array, add this path
          paths.push(newPrefix);
        } else if (typeof value === 'object' && value !== null) {
          // Recursively search nested objects
          paths.push(...extractArrayPaths(value, newPrefix));
        }
      });
    }

    return paths;
  }, []);

  const runImport = async (): Promise<void> => {
    const externalBase = side === 'left' ? props.coreBase.leftExternalBase : props.coreBase.rightExternalBase;
    if (!externalBase || !selectedTable || !selectedMatchField || !result) {
      return;
    }

    setImporting(true);
    try {
      // const importResponse = await ApiV1.apiImport.import({
      //   externalBaseId: externalBase.id,
      //   tableName: selectedTable.name,
      //   matchOn: selectedMatchField,
      //   records: result ?? [],
      // });

      // Store the detailed results
      // setImportResults({
      //   created: importResponse.created || 0,
      //   updated: importResponse.updated || 0,
      //   failed: importResponse.failed || 0,
      // });

      // // Show success notification with summary
      // const total = (importResponse.created || 0) + (importResponse.updated || 0) + (importResponse.failed || 0);
      // Notifications.success({
      //   message: `Import completed! ${importResponse.created || 0} created, ${importResponse.updated || 0} updated, ${importResponse.failed || 0} failed out of ${total} records.`,
      // });
    } catch (error: any) {
      // Notifications.error({ message: `Import failed: ${error.message || 'Unknown error'}` });
      setImportResults(null);
    } finally {
      setImporting(false);
    }
  };

  const handleFetch = async (): Promise<void> => {
    debugger;
    setError(null);
    setResponse(null);
    try {
      // Parse JSON fetch parameters with new structure
      const fetchConfig = JSON.parse(curl);
      debugger;
      const { url, params = {} } = fetchConfig;

      debugger;
      // Call server-side fetch instead of local fetch
      const resp = await fetch('http://localhost:3000/rest/api-import/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, params }),
      }) as any;
      
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      
      const data = await resp.json();
      setResponse(data);
      
      // const data = await ApiV1.apiImport.fetch({
      //   data: {
      //     url,
      //     params,
      //   },
      // });
      // debugger;
      // setResponse(data as any);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleApplyMapping = async (): Promise<void> => {
    setError(null);
    try {
      if (!response) throw new Error('No API response available. Fetch data first.');
      if (!recordArrayPath) throw new Error('No record array path selected.');

      // Get the array data from the selected path
      const arrayData = recordArrayPath === '.' ? response : _.get(response, recordArrayPath);
      if (!Array.isArray(arrayData)) throw new Error('Selected path does not point to an array.');

      const mapped = applyMapping(arrayData, fieldMappings);
      // Keep response as raw data, store mapped data in result
      setResult(mapped);
      const newColumns: GridColumn[] = Object.keys(fieldMappings)
        .filter((key) => fieldMappings[key])
        .map((key) => ({
          title: key,
          id: key,
          width: 200,
        }));
      setColumns(newColumns);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      if (!result || !result[row] || !columns[col]) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
          readonly: true,
        };
      }

      const record = result[row];
      const column = columns[col];
      const colId = column.id;

      if (!colId) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
          readonly: true,
        };
      }

      const cellData = record[colId];
      const displayValue = String(cellData ?? '');

      return {
        kind: GridCellKind.Text,
        data: displayValue,
        displayData: displayValue,
        allowOverlay: true,
        readonly: false,
      };
    },
    [result, columns],
  );

  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const column = columns[col];
      const colId = column.id;

      if (colId === undefined) return;

      setResult((r) => {
        if (!r) return r;
        const newResult = [...r];
        newResult[row] = { ...newResult[row], [colId]: newValue.data };
        return newResult;
      });
    },
    [columns],
  );

  const onDelete = useCallback(
    (selection: GridSelection) => {
      if (!result || !selection.rows) return false;

      setResult((r) => {
        if (!r) return r;
        // Convert CompactSelection to array of row indices
        const rowsToDelete: number[] = [];
        // CompactSelection.rows has a hasIndex method to check individual rows
        for (let i = 0; i < r.length; i++) {
          if (selection.rows.hasIndex(i)) {
            rowsToDelete.push(i);
          }
        }

        // Sort rows in descending order to delete from end to start
        const sortedRows = [...rowsToDelete].sort((a, b) => b - a);
        const newResult = [...r];

        // Delete rows from end to start to maintain correct indices
        sortedRows.forEach((rowIndex) => {
          newResult.splice(rowIndex, 1);
        });

        return newResult;
      });

      return true; // Return true to indicate the deletion was handled
    },
    [result],
  );

  const openPathModal = (fieldName: string): void => {
    setCurrentField(fieldName);
    if (response && recordArrayPath) {
      // Get the array data from the selected path
      const arrayData = recordArrayPath === '.' ? response : _.get(response, recordArrayPath);
      if (Array.isArray(arrayData) && arrayData.length > 0) {
        // Extract paths from the first item in the selected array
        const paths = extractPaths(arrayData[0]);

        // Sort paths hierarchically with leaf fields first at each level
        const sortedPaths = paths.sort((a, b) => {
          const aParts = a.split('.');
          const bParts = b.split('.');

          // Compare each level of the path
          const maxLength = Math.max(aParts.length, bParts.length);

          for (let i = 0; i < maxLength; i++) {
            const aPart = aParts[i] || '';
            const bPart = bParts[i] || '';

            if (aPart !== bPart) {
              // If one path is shorter (parent), it comes first
              if (!aPart) return -1;
              if (!bPart) return 1;

              // At this level, check if either field has children
              const aPrefix = aParts.slice(0, i + 1).join('.');
              const bPrefix = bParts.slice(0, i + 1).join('.');

              const aHasChildren = paths.some((path) => path.startsWith(aPrefix + '.') && path !== a);
              const bHasChildren = paths.some((path) => path.startsWith(bPrefix + '.') && path !== b);

              // If one has children and other doesn't, leaf field comes first
              if (aHasChildren !== bHasChildren) {
                return aHasChildren ? 1 : -1;
              }

              // Otherwise sort alphabetically at this level
              return aPart.localeCompare(bPart);
            }
          }

          // If all parts are equal up to this point, shorter path comes first
          return aParts.length - bParts.length;
        });

        setAvailablePaths(sortedPaths);
      } else {
        setAvailablePaths([]);
      }
    } else {
      setAvailablePaths([]);
    }
    setPathModalOpened(true);
  };

  const handleAiGenerate = async (): Promise<void> => {
    if (!aiPrompt.trim()) return;

    setAiGenerating(true);
    try {
      debugger;
      const resp = await fetch('http://localhost:3000/rest/api-import/generate-fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: aiPrompt }),
      }) as any; 
      const data = await resp.json();
      // setCurl(JSON.stringify(data, null, 2));

      // const result = await ApiV1.apiImport.generateFetch({
      //   prompt: aiPrompt,
      // });

      // Set the JSON fetch parameters with new structure
      const fetchConfig = {
        url: data.url,
        params: {
          method: data.params.method || 'GET',
          headers: data.params.headers || {},
          body: data.params.body || null,
        },
      };

      setCurl(JSON.stringify(fetchConfig, null, 2));
      setAiPrompt(''); // Clear the prompt after successful generation
    } catch (err: any) {
      debugger;
      setError(`AI generation failed: ${err.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <Stack gap="md">
      {/* Step 1: API Configuration and Data Fetching */}
      <Stack gap="sm">
        <Text size="lg" fw={600}>
          1. Configure API Request
        </Text>

        {/* Curl Input and API Response Side by Side */}
        <Group align="flex-start" gap="md">
          <Stack style={{ flex: 1 }} gap="sm">
            {/* AI Fetch Generation */}
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Generate fetch parameters with AI (optional)
              </Text>
              <Textarea
                placeholder="Describe your API request (e.g., 'I have an airtable base with id appXXX, table tblYYY, token pat123, generate request to fetch data')"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                styles={{ input: { height: '120px' } }}
              />
              <Button
                leftSection={<Sparkle size={16} />}
                onClick={handleAiGenerate}
                loading={aiGenerating}
                disabled={!aiPrompt.trim()}
                size="sm"
                variant="light"
              >
                Generate Parameters
              </Button>
            </Stack>

            {/* Fetch Parameters */}
            <Textarea
              label="Fetch Parameters (JSON)"
              placeholder='{"url": "https://api.example.com/data", "params": {"method": "GET", "headers": {"Authorization": "Bearer token"}, "body": null}}'
              value={curl}
              onChange={(e) => setCurl(e.target.value)}
              styles={{ input: { fontFamily: 'monospace', fontSize: '12px', height: '200px' } }}
            />

            <Button
              onClick={handleFetch}
              disabled={!curl.trim()}
              leftSection={<ArrowRight size={16} />}
              style={{ width: '140px' }}
            >
              Fetch Data
            </Button>
          </Stack>

          <Stack style={{ flex: 1 }}>
            <Textarea
              label="Raw API Response"
              value={response ? JSON.stringify(response, null, 2) : 'No response yet'}
              readOnly
              styles={{ input: { fontFamily: 'monospace', fontSize: '12px', height: '400px' } }}
            />
          </Stack>
        </Group>

        {error && (
          <Text c="red" size="sm">
            Error: {error}
          </Text>
        )}
      </Stack>

      {/* Step 2: Side and Table Selection (only show after successful data fetch) */}
      {response && (
        <Stack gap="sm">
          <Text size="lg" fw={600}>
            2. Select Destination
          </Text>

          <Table>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td style={{ width: '200px' }}>
                  <Text size="sm" fw={500}>
                    Select side:
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    placeholder="Choose side"
                    data={[
                      { value: 'left', label: `${props.coreBase.leftExternalBase?.name || 'Left'} (Left)` },
                      { value: 'right', label: `${props.coreBase.rightExternalBase?.name || 'Right'} (Right)` },
                    ]}
                    value={side}
                    onChange={(value) => {
                      setSide(value as 'left' | 'right');
                      setSelectedTable(null);
                    }}
                  />
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    Select table:
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Select
                    placeholder="Choose table"
                    data={
                      externalBase?.externalTables?.map((table) => ({
                        value: table.id,
                        label: table.name,
                      })) || []
                    }
                    value={selectedTable?.id ?? ''}
                    onChange={(value) => {
                      const selectedTable = externalBase?.externalTables?.find((table) => table.id === value);
                      setSelectedTable(selectedTable ?? null);
                    }}
                    disabled={!side}
                  />
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Stack>
      )}

      {/* Step 2.5: Record Array Path Selection (only show after table selection) */}
      {response && selectedTable && (
        <Stack gap="sm">
          <Text size="lg" fw={600}>
            2.5. Select Record Array Path
          </Text>

          <Table>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td style={{ width: '200px' }}>
                  <Text size="sm" fw={500}>
                    Path to records array:
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Textarea
                      placeholder="e.g., records, data, items (use '.' for root level array)"
                      value={recordArrayPath}
                      onChange={(e) => setRecordArrayPath(e.target.value)}
                      size="sm"
                      autosize
                      minRows={1}
                      maxRows={3}
                      style={{ flex: 1 }}
                    />
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={() => {
                        if (response) {
                          // Extract all possible array paths from the response
                          const paths = extractArrayPaths(response);
                          // Add root level option if response is an array
                          if (Array.isArray(response)) {
                            paths.unshift('.');
                          }
                          setAvailableArrayPaths(paths);
                        }
                        setRecordArrayPathModalOpened(true);
                      }}
                    >
                      <MagnifyingGlass size={14} />
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>

          {recordArrayPath && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Preview of selected array:
              </Text>
              {(() => {
                try {
                  const arrayData = recordArrayPath === '.' ? response : _.get(response, recordArrayPath);
                  if (Array.isArray(arrayData)) {
                    return (
                      <Text size="sm" c="green">
                        ✓ Found array with {arrayData.length} items
                      </Text>
                    );
                  } else {
                    return (
                      <Text size="sm" c="red">
                        ✗ Path does not point to an array
                      </Text>
                    );
                  }
                } catch {
                  return (
                    <Text size="sm" c="red">
                      ✗ Invalid path
                    </Text>
                  );
                }
              })()}
            </Stack>
          )}
        </Stack>
      )}

      {/* Step 3: Field Mapping (only show after record array path is selected and valid) */}
      {response &&
        selectedTable &&
        selectedTable.externalColumns &&
        recordArrayPath &&
        (() => {
          try {
            const arrayData = recordArrayPath === '.' ? response : _.get(response, recordArrayPath);
            return Array.isArray(arrayData) && arrayData.length > 0;
          } catch {
            return false;
          }
        })() && (
          <Stack gap="sm">
            <Text size="lg" fw={600}>
              3. Map Fields
            </Text>

            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Field Name</Table.Th>
                  <Table.Th>API Response Path</Table.Th>
                  <Table.Th>
                    <Group gap="xs">
                      <Text c={!selectedMatchField ? 'red' : undefined}>Match Field</Text>
                      <Text c="red" size="sm">
                        *
                      </Text>
                      <Tooltip label="Select the field to use for matching records during import">
                        <Question size={14} />
                      </Tooltip>
                    </Group>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {selectedTable.externalColumns.map((field) => (
                  <Table.Tr key={field.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {field.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Textarea
                          placeholder="e.g., data.0.name or items[0].title"
                          value={fieldMappings[field.name] || ''}
                          onChange={(e) =>
                            setFieldMappings((prev) => ({
                              ...prev,
                              [field.name]: e.target.value,
                            }))
                          }
                          size="sm"
                          autosize
                          minRows={1}
                          maxRows={3}
                          style={{ flex: 1 }}
                        />
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => {
                            openPathModal(field.name);
                          }}
                        >
                          <MagnifyingGlass size={14} />
                        </Button>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Radio
                        value={field.name}
                        checked={selectedMatchField === field.name}
                        onChange={() => setSelectedMatchField(field.name)}
                      />
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}

      {/* Step 4: Apply Mapping (only show when field mapping is configured) */}
      {response && selectedTable && selectedTable.externalColumns && selectedMatchField && (
        <Stack gap="sm">
          <Text size="lg" fw={600}>
            4. Apply Mapping
          </Text>

          <Button
            onClick={handleApplyMapping}
            disabled={!response || Object.keys(fieldMappings).length === 0}
            leftSection={<ArrowRight size={16} />}
            style={{ width: '140px' }}
          >
            Apply Mapping
          </Button>

          {/* Mapped Data Table */}
          {result && result.length > 0 && (
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>
                  Mapped Data Preview:
                </Text>
                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="outline"
                    color="red"
                    onClick={() => {
                      if (gridSelection?.rows && result) {
                        // Convert CompactSelection to array of row indices
                        const rowsToDelete: number[] = [];
                        for (let i = 0; i < result.length; i++) {
                          if (gridSelection.rows.hasIndex(i)) {
                            rowsToDelete.push(i);
                          }
                        }

                        if (rowsToDelete.length > 0) {
                          // Sort rows in descending order to delete from end to start
                          const sortedRows = [...rowsToDelete].sort((a, b) => b - a);
                          setResult((r) => {
                            if (!r) return r;
                            const newResult = [...r];

                            // Delete rows from end to start to maintain correct indices
                            sortedRows.forEach((rowIndex) => {
                              newResult.splice(rowIndex, 1);
                            });

                            return newResult;
                          });

                          // Clear selection after deletion
                          setGridSelection(undefined);
                        }
                      }
                    }}
                    disabled={
                      !gridSelection?.rows ||
                      !result ||
                      (() => {
                        // Check if any rows are selected
                        if (!gridSelection?.rows || !result) return true;
                        for (let i = 0; i < result.length; i++) {
                          if (gridSelection.rows.hasIndex(i)) {
                            return false;
                          }
                        }
                        return true;
                      })()
                    }
                  >
                    Delete Selected
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    color="red"
                    onClick={() => {
                      setResult([]);
                      setGridSelection(undefined);
                    }}
                    disabled={!result || result.length === 0}
                  >
                    Clear All
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    color="blue"
                    onClick={() => {
                      if (!result || !columns) return;

                      // Create an empty row with all column fields set to empty strings
                      const emptyRow: Record<string, any> = {};
                      columns.forEach((column) => {
                        if (column.id) {
                          emptyRow[column.id] = '';
                        }
                      });

                      setResult((r) => {
                        if (!r) return [emptyRow];
                        return [...r, emptyRow];
                      });
                    }}
                    disabled={!result || !columns || columns.length === 0}
                  >
                    Add Row
                  </Button>
                  <Text size="xs" c="dimmed">
                    Click row numbers to select. Use Ctrl/Cmd+click for multi-select, Shift+click for range
                  </Text>
                </Group>
              </Group>
              <Box style={{ flexGrow: 1, height: 300 }}>
                <DataEditor
                  columns={columns}
                  rows={result.length}
                  getCellContent={getCellContent}
                  onCellEdited={onCellEdited}
                  onDelete={onDelete}
                  width="100%"
                  height="100%"
                  rowMarkers="both"
                  columnSelect="multi"
                  rowSelect="multi"
                  rangeSelect="multi-rect"
                  editOnType={true}
                  gridSelection={gridSelection}
                  onGridSelectionChange={setGridSelection}
                  getCellsForSelection={true}
                />
              </Box>
            </Stack>
          )}
        </Stack>
      )}

      {/* Step 5: Run Import (only show when mapping is applied) */}
      {response && selectedTable && selectedMatchField && result && result.length > 0 && (
        <Stack gap="sm">
          <Text size="lg" fw={600}>
            5. Run Import
          </Text>

          <Button
            onClick={runImport}
            disabled={!externalBase || !selectedTable || !selectedMatchField}
            loading={importing}
            leftSection={<ArrowRight size={16} />}
            style={{ width: '140px' }}
          >
            Run Import
          </Button>

          {/* Import Results */}
          {importResults && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Import Results:
              </Text>
              <Table>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>
                      <Text size="sm" c="green">
                        ✓ Created:
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {importResults.created}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Text size="sm" c="blue">
                        ↻ Updated:
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {importResults.updated}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Text size="sm" c="red">
                        ✗ Failed:
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {importResults.failed}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        Total:
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {importResults.created + importResults.updated + importResults.failed}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Stack>
          )}
        </Stack>
      )}

      {/* Path Selection Modal */}
      <Modal
        opened={pathModalOpened}
        onClose={() => setPathModalOpened(false)}
        title="Select API Response Path"
        size="lg"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Click on a path to use it for the selected field:
          </Text>
          <Stack gap="xs" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {availablePaths.map((path) => (
              <Button
                key={path}
                variant="subtle"
                justify="flex-start"
                onClick={() => {
                  setFieldMappings((prev) => ({
                    ...prev,
                    [currentField]: path,
                  }));
                  setPathModalOpened(false);
                }}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              >
                {path}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Modal>

      {/* Array Path Selection Modal */}
      <Modal
        opened={recordArrayPathModalOpened}
        onClose={() => setRecordArrayPathModalOpened(false)}
        title="Select Array Path"
        size="lg"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Click on a path to select the array containing your records:
          </Text>
          <Stack gap="xs" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {availableArrayPaths.map((path) => (
              <Button
                key={path}
                variant="subtle"
                justify="flex-start"
                onClick={() => {
                  setRecordArrayPath(path);
                  setRecordArrayPathModalOpened(false);
                }}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              >
                {path === '.' ? '(root level array)' : path}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Modal>

      <div id="portal" style={{ position: 'fixed', left: 0, top: 0, zIndex: 9999 }} />
    </Stack>
  );
};

function applyMapping(dataArray: any[], mapping: Record<string, string>): any[] {
  return dataArray.map((item) => {
    const output: Record<string, any> = {};
    for (const [pgCol, path] of Object.entries(mapping)) {
      output[pgCol] = _.get(item, path);
    }
    return output;
  });
}
