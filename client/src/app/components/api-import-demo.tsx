/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DataEditor,
  EditableGridCell,
  GridCell,
  GridCellKind,
  GridColumn,
  GridSelection,
  Item,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import {
  Box,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  Textarea,
  ActionIcon,
  TextInput,
  Container,
  Select,
} from "@mantine/core";
import {
  ArrowRight,
  MagnifyingGlass,
  Plus,
  Sparkle,
  Trash,
} from "@phosphor-icons/react";
import _ from "lodash";
import { FC, useCallback, useEffect, useState, useRef } from "react";
import { useGenericTables, useGenericTable } from "@/hooks/use-generic-table";
import { CreateGenericTableDto } from "@/types/server-entities/generic-table";

interface MappingRow {
  id: string;
  destination: string;
  source: string;
  pgType: string;
}

export const ApiImport: FC = () => {
  const nextMappingId = useRef(1);

  // GenericTable state
  const { data: genericTables, createGenericTable, isLoading: tablesLoading } = useGenericTables();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const { data: selectedTable } = useGenericTable(selectedTableId || "");
  const [tableName, setTableName] = useState("");

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
  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [gridSelection, setGridSelection] = useState<
    GridSelection | undefined
  >();
  const [pathModalOpened, setPathModalOpened] = useState(false);
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [result, setResult] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);

  // State for record array path selection
  const [recordArrayPath, setRecordArrayPath] = useState<string>("");
  const [recordArrayPathModalOpened, setRecordArrayPathModalOpened] =
    useState(false);
  const [availableArrayPaths, setAvailableArrayPaths] = useState<string[]>([]);

  // New state for dynamic field mappings
  const [mappings, setMappings] = useState<MappingRow[]>([
    { id: "mapping-0", destination: "", source: "", pgType: "text" },
  ]);
  const [currentMappingId, setCurrentMappingId] = useState<string | null>(null);

  // Function to extract all possible paths from an object
  const extractPaths = useCallback((obj: any, prefix = ""): string[] => {
    const paths: string[] = [];
    if (Array.isArray(obj) && obj.length > 0) {
      const firstItem = obj[0];
      if (typeof firstItem === "object" && firstItem !== null) {
        paths.push(...extractPaths(firstItem, prefix));
      } else {
        paths.push(prefix || "[0]");
      }
    } else if (typeof obj === "object" && obj !== null) {
      Object.keys(obj).forEach((key) => {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (typeof value === "object" && value !== null) {
          paths.push(...extractPaths(value, newPrefix));
        } else {
          paths.push(newPrefix);
        }
      });
    }
    return paths;
  }, []);

  // Function to extract all possible paths from an array of objects (combining all fields)
  const extractAllPathsFromArray = useCallback((array: any[]): string[] => {
    const allPaths = new Set<string>();
    
    array.forEach((item) => {
      if (typeof item === "object" && item !== null) {
        const paths = extractPaths(item);
        paths.forEach(path => allPaths.add(path));
      }
    });
    
    return Array.from(allPaths);
  }, [extractPaths]);

  // Update available paths when response changes
  useEffect(() => {
    if (response && recordArrayPath) {
      const arrayData =
        recordArrayPath === "." ? response : _.get(response, recordArrayPath);
      if (Array.isArray(arrayData) && arrayData.length > 0) {
        const paths = extractAllPathsFromArray(arrayData);
        const sortedPaths = paths.sort((a, b) => a.localeCompare(b));
        setAvailablePaths(sortedPaths);
      } else {
        setAvailablePaths([]);
      }
    } else {
      setAvailablePaths([]);
    }
  }, [response, recordArrayPath, extractAllPathsFromArray]);

  // Populate form when a table is selected
  useEffect(() => {
    if (selectedTable) {
      // Populate the fetch configuration
      if (selectedTable.fetch) {
        setCurl(JSON.stringify(selectedTable.fetch, null, 2));
      }
      
      // Populate the mapping configuration
      if (selectedTable.mapping && typeof selectedTable.mapping === 'object') {
        const mapping = selectedTable.mapping as any;
        if (mapping.recordArrayPath) {
          setRecordArrayPath(mapping.recordArrayPath);
        }
        if (mapping.fieldMappings) {
          const fieldMappings = mapping.fieldMappings as Record<string, string>;
          const fieldTypes = mapping.fieldTypes as Record<string, string> || {};
          const newMappings: MappingRow[] = Object.entries(fieldMappings).map(([destination, source], index) => ({
            id: `mapping-${index}`,
            destination,
            source,
            pgType: fieldTypes[destination] || "text",
          }));
          setMappings(newMappings);
          nextMappingId.current = newMappings.length;
        }
      }
      
      // Set the table name
      setTableName(selectedTable.name);
    }
  }, [selectedTable]);

  // Function to extract all possible array paths from an object
  const extractArrayPaths = useCallback((obj: any, prefix = ""): string[] => {
    const paths: string[] = [];
    if (Array.isArray(obj)) {
      paths.push(prefix || "root");
    } else if (typeof obj === "object" && obj !== null) {
      Object.keys(obj).forEach((key) => {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (Array.isArray(value)) {
          paths.push(newPrefix);
        } else if (typeof value === "object" && value !== null) {
          paths.push(...extractArrayPaths(value, newPrefix));
        }
      });
    }
    return paths;
  }, []);

  const runImport = async (): Promise<void> => {
    if (!result) return;
    setImporting(true);
    setError(null);
    try {
      // Create the fetch configuration from the current curl
      const fetchConfig = JSON.parse(curl);
      
      // Create the mapping configuration from the current mappings
      const fieldMappings = mappings.reduce((acc, m) => {
        if (m.destination && m.source) {
          acc[m.destination] = m.source;
        }
        return acc;
      }, {} as Record<string, string>);

      const fieldTypes = mappings.reduce((acc, m) => {
        if (m.destination && m.pgType) {
          acc[m.destination] = m.pgType;
        }
        return acc;
      }, {} as Record<string, string>);

      // Create the generic table with fetch and mapping data
      const createTableDto: CreateGenericTableDto = {
        name: tableName || `Table from ${fetchConfig.url || 'API'}`,
        fetch: fetchConfig,
        mapping: {
          recordArrayPath,
          fieldMappings,
          fieldTypes,
        },
      };

      const createdTable = await createGenericTable(createTableDto);
      alert(`Successfully created table "${createdTable.name}" with ${result.length} records!`);
      setResult(null); // Clear the grid after successful creation
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleFetch = async (): Promise<void> => {
    setError(null);
    setResponse(null);
    try {
      const fetchConfig = JSON.parse(curl);
      const { url, params = {} } = fetchConfig;
      // Make a direct call to the NestJS backend
      const resp = await fetch(process.env.NEXT_PUBLIC_API_URL+"/rest/api-import/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, params }),
      });
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleApplyMapping = async (): Promise<void> => {
    setError(null);
    try {
      if (!response) throw new Error("No API response available.");
      if (!recordArrayPath) throw new Error("No record array path selected.");

      const arrayData =
        recordArrayPath === "." ? response : _.get(response, recordArrayPath);
      if (!Array.isArray(arrayData))
        throw new Error("Selected path does not point to an array.");

      const fieldMappings = mappings.reduce((acc, m) => {
        if (m.destination && m.source) {
          acc[m.destination] = m.source;
        }
        return acc;
      }, {} as Record<string, string>);

      const mapped = applyMapping(arrayData, fieldMappings);
      setResult(mapped);

      const newColumns: GridColumn[] = mappings
        .filter((m) => m.destination)
        .map((m) => ({
          title: `${m.destination} (${m.pgType})`,
          id: m.destination,
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
          data: "",
          displayData: "",
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
          data: "",
          displayData: "",
          allowOverlay: false,
          readonly: true,
        };
      }
      const cellData = record[colId];
      const displayValue = String(cellData ?? "");
      return {
        kind: GridCellKind.Text,
        data: displayValue,
        displayData: displayValue,
        allowOverlay: true,
        readonly: false,
      };
    },
    [result, columns]
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
    [columns]
  );

  const onDelete = useCallback(
    (selection: GridSelection) => {
      if (!result || !selection.rows) return false;
      setResult((r) => {
        if (!r) return r;
        const rowsToDelete: number[] = [];
        for (let i = 0; i < r.length; i++) {
          if (selection.rows.hasIndex(i)) {
            rowsToDelete.push(i);
          }
        }
        const sortedRows = [...rowsToDelete].sort((a, b) => b - a);
        const newResult = [...r];
        sortedRows.forEach((rowIndex) => {
          newResult.splice(rowIndex, 1);
        });
        return newResult;
      });
      return true;
    },
    [result]
  );

  const openPathModal = (mappingId: string): void => {
    setCurrentMappingId(mappingId);
    setPathModalOpened(true);
  };

  const handleMappingChange = (
    id: string,
    field: "destination" | "source" | "pgType",
    value: string
  ) => {
    setMappings((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const addMappingRow = () => {
    setMappings((prev) => [
      ...prev,
      { id: `mapping-${nextMappingId.current++}`, destination: "", source: "", pgType: "text" },
    ]);
  };

  const removeMappingRow = (id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAiGenerate = async (): Promise<void> => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    try {
      // Make a direct call to the NestJS backend
      const resp = await fetch(
        process.env.NEXT_PUBLIC_API_URL+"/rest/api-import/generate-fetch",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: aiPrompt }),
        }
      );
      debugger;
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      setCurl(JSON.stringify(data, null, 2));
      setAiPrompt("");
    } catch (err: any) {
      setError(`AI generation failed: ${err.message}`);
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <Container size="xl" py="xl">
      <Stack gap="md">
        {/* Step 0: GenericTable Selection */}
        <Stack gap="sm">
          <Text size="lg" fw={600}>
            0. Select or Create Table
          </Text>
          {!selectedTableId ? (
            <Stack gap="sm">
              {genericTables && genericTables.length > 0 && (
                <Stack gap="xs">
                  <Text size="sm" fw={500}>
                    Select existing table:
                  </Text>
                  <Select
                    placeholder="Choose a table"
                    data={genericTables.map((table) => ({
                      value: table.id,
                      label: table.name,
                    }))}
                    onChange={(value) => setSelectedTableId(value)}
                    disabled={tablesLoading}
                  />
                  <Text size="xs" c="dimmed">
                    Or create a new one in the steps below
                  </Text>
                </Stack>
              )}
              
              {genericTables && genericTables.length === 0 && (
                <Text size="sm" c="dimmed">
                  No tables found. Create a new table using the steps below.
                </Text>
              )}
            </Stack>
          ) : (
            <Group gap="xs">
              <Text size="sm">
                Selected: {genericTables?.find(t => t.id === selectedTableId)?.name || "Unknown"}
              </Text>
              <Button
                variant="light"
                size="xs"
                onClick={() => setSelectedTableId(null)}
              >
                Change
              </Button>
            </Group>
          )}
        </Stack>

        {/* Step 1: API Configuration and Data Fetching */}
        <Stack gap="sm">
          <Text size="lg" fw={600}>
            1. Configure API Request {selectedTableId && "(Read-only)"}
          </Text>
          <Group align="flex-start" gap="md">
            <Stack style={{ flex: 1 }} gap="sm">
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Generate fetch parameters with AI (optional)
                </Text>
                <Textarea
                  placeholder="e.g., 'Get users from JSONPlaceholder'"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  styles={{ input: { height: "120px" } }}
                  disabled={!!selectedTableId}
                />
                <Button
                  leftSection={<Sparkle size={16} />}
                  onClick={handleAiGenerate}
                  loading={aiGenerating}
                  disabled={!aiPrompt.trim() || !!selectedTableId}
                  size="sm"
                  variant="light"
                >
                  Generate Parameters
                </Button>
              </Stack>
              <Textarea
                label="Fetch Parameters (JSON)"
                placeholder='{"url": "...", "params": {...}}'
                value={curl}
                onChange={(e) => setCurl(e.target.value)}
                styles={{
                  input: {
                    fontFamily: "monospace",
                    fontSize: "12px",
                    height: "200px",
                  },
                }}
                disabled={!!selectedTableId}
              />
              <Button
                onClick={handleFetch}
                disabled={!curl.trim() || !!selectedTableId}
                leftSection={<ArrowRight size={16} />}
                style={{ width: "140px" }}
              >
                Fetch Data
              </Button>
            </Stack>
            <Stack style={{ flex: 1 }}>
              <Textarea
                label="Raw API Response"
                value={
                  response
                    ? JSON.stringify(response, null, 2)
                    : "No response yet. Click 'Fetch Data' to get started."
                }
                styles={{
                  input: {
                    fontFamily: "monospace",
                    fontSize: "12px",
                    height: "400px",
                  },
                }}
                readOnly
              />
            </Stack>
          </Group>
          {error && (
            <Text c="red" size="sm">
              Error: {error}
            </Text>
          )}
        </Stack>

        {/* Step 2: Record Array Path Selection */}
        {response && (
          <Stack gap="sm">
            <Text size="lg" fw={600}>
              2. Select Record Array Path {selectedTableId && "(Read-only)"}
            </Text>
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Where are your records located in the response?
              </Text>
              <Button
                variant="light"
                size="xs"
                onClick={() => {
                  const paths = extractArrayPaths(response);
                  setAvailableArrayPaths(paths);
                  setRecordArrayPathModalOpened(true);
                }}
                disabled={!!selectedTableId}
              >
                Browse Paths
              </Button>
            </Group>
            {recordArrayPath && (
              <Group gap="xs">
                <Text size="sm" fw={500}>
                  Selected path:
                </Text>
                <Text
                  size="sm"
                  style={{
                    fontFamily: "monospace",
                    backgroundColor: "var(--mantine-color-gray-1)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {recordArrayPath === "." ? "(root level array)" : recordArrayPath}
                </Text>
                {!selectedTableId && (
                  <Button
                    variant="light"
                    size="xs"
                    onClick={() => setRecordArrayPath("")}
                  >
                    Change
                  </Button>
                )}
              </Group>
            )}
          </Stack>
        )}

        {/* Step 3: Field Mapping */}
        {response && recordArrayPath && (
          <Stack gap="sm">
            <Text size="lg" fw={600}>
              3. Map Fields {selectedTableId && "(Read-only)"}
            </Text>
            <Stack gap="xs">
              {mappings.map((mapping) => (
                <Group key={mapping.id} gap="xs">
                  <ActionIcon
                    variant="light"
                    color="blue"
                    onClick={() => openPathModal(mapping.id)}
                    disabled={!!selectedTableId}
                  >
                    <MagnifyingGlass size={16} />
                  </ActionIcon>
                  <TextInput
                    placeholder="Source path from API"
                    value={mapping.source}
                    onChange={(e) =>
                      handleMappingChange(mapping.id, "source", e.target.value)
                    }
                    style={{ flex: 1 }}
                    disabled={!!selectedTableId}
                  />
                  <Text size="sm">→</Text>
                  <TextInput
                    placeholder="Destination field name"
                    value={mapping.destination}
                    onChange={(e) =>
                      handleMappingChange(mapping.id, "destination", e.target.value)
                    }
                    style={{ flex: 1 }}
                    disabled={!!selectedTableId}
                  />
                  <Select
                    placeholder="Type"
                    value={mapping.pgType}
                    onChange={(value) =>
                      handleMappingChange(mapping.id, "pgType", value || "text")
                    }
                    data={[
                      { value: "text", label: "Text" },
                      { value: "text[]", label: "Text Array" },
                      { value: "numeric", label: "Numeric" },
                      { value: "numeric[]", label: "Numeric Array" },
                      { value: "boolean", label: "Boolean" },
                      { value: "boolean[]", label: "Boolean Array" },
                      { value: "jsonb", label: "JSONB" },
                    ]}
                    style={{ width: "120px" }}
                    disabled={!!selectedTableId}
                  />
                  {!selectedTableId && (
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => removeMappingRow(mapping.id)}
                      disabled={mappings.length === 1}
                    >
                      <Trash size={16} />
                    </ActionIcon>
                  )}
                </Group>
              ))}
              {!selectedTableId && (
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<Plus size={16} />}
                  onClick={addMappingRow}
                  style={{ width: "fit-content" }}
                >
                  Add Field Mapping
                </Button>
              )}
            </Stack>
          </Stack>
        )}

        {/* Step 4: Apply Mapping */}
        {response && recordArrayPath && (
          <Stack gap="sm">
            <Text size="lg" fw={600}>
              4. Apply Mapping {selectedTableId && "(Read-only)"}
            </Text>
            <Button
              onClick={handleApplyMapping}
              disabled={!response || mappings.length === 0 || !!selectedTableId}
              leftSection={<ArrowRight size={16} />}
              style={{ width: "140px" }}
            >
              Apply Mapping
            </Button>
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
                      onClick={() => onDelete(gridSelection!)}
                      disabled={!gridSelection?.rows || result.length === 0}
                    >
                      Delete Selected
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      color="red"
                      onClick={() => setResult([])}
                      disabled={!result || result.length === 0}
                    >
                      Clear All
                    </Button>
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

        {/* Step 5: Create Table */}
        {result && result.length > 0 && !selectedTableId && (
          <Stack gap="sm">
            <Text size="lg" fw={600}>
              5. Create Table
            </Text>
            <TextInput
              label="Table Name"
              placeholder="Enter a name for this table"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              style={{ maxWidth: "400px" }}
            />
            <Button
              onClick={runImport}
              loading={importing}
              leftSection={<ArrowRight size={16} />}
              style={{ width: "140px" }}
            >
              Create Table
            </Button>
          </Stack>
        )}

        {/* Step 5: Run Table (when table is selected) */}
        {selectedTableId && (
          <Stack gap="sm">
            <Text size="lg" fw={600}>
              5. Run Table
            </Text>
            <Button
              onClick={async () => {
                // Run fetch and apply mapping automatically
                await handleFetch();
                await handleApplyMapping();
              }}
              loading={importing}
              leftSection={<ArrowRight size={16} />}
              style={{ width: "140px" }}
            >
              Run Table
            </Button>
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
            <Stack gap="xs" style={{ maxHeight: "400px", overflowY: "auto" }}>
              {availablePaths.map((path) => (
                <Button
                  key={path}
                  variant="subtle"
                  justify="flex-start"
                  onClick={() => {
                    if (currentMappingId) {
                      handleMappingChange(currentMappingId, "source", path);
                      // Auto-populate destination field by replacing dots with underscores
                      const destinationField = path.replace(/\./g, "_");
                      handleMappingChange(
                        currentMappingId,
                        "destination",
                        destinationField
                      );
                    }
                    setPathModalOpened(false);
                  }}
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
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
            <Stack gap="xs" style={{ maxHeight: "400px", overflowY: "auto" }}>
              {availableArrayPaths.map((path) => (
                <Button
                  key={path}
                  variant="subtle"
                  justify="flex-start"
                  onClick={() => {
                    setRecordArrayPath(path);
                    setRecordArrayPathModalOpened(false);
                  }}
                  style={{ fontFamily: "monospace", fontSize: "12px" }}
                >
                  {path === "." ? "(root level array)" : path}
                </Button>
              ))}
            </Stack>
          </Stack>
        </Modal>
      </Stack>
    </Container>
  );
};

function applyMapping(
  dataArray: any[],
  mapping: Record<string, string>
): any[] {
  return dataArray.map((item) => {
    const output: Record<string, any> = {};
    for (const [destination, source] of Object.entries(mapping)) {
      if (destination && source) {
        output[destination] = _.get(item, source);
      }
    }
    return output;
  });
}
