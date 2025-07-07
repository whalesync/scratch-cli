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
  Tabs,
  Tooltip,
  Accordion,
  Loader,
  Center,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
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
import { useGenerateDeleteRecord } from "@/hooks/use-api-import";


interface MappingRow {
  id: string;
  destination: string;
  source: string;
  pgType: string;
}

export const ApiImport: FC = () => {
  const nextMappingId = useRef(1);

  // Global loading state for this component
  const [loading, setLoading] = useState(false);

  // Popup state for table name
  const [tableNameModalOpened, setTableNameModalOpened] = useState(false);
  const [newTableName, setNewTableName] = useState("");

  // GenericTable state
  const { data: genericTables, createGenericTable, updateGenericTable, deleteGenericTable, isLoading: tablesLoading } = useGenericTables();
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const { data: selectedTable } = useGenericTable(selectedTableId || "");
  const [tableName, setTableName] = useState("");

  console.log('Current selectedTableId:', selectedTableId);

  const [pollRecordsFunction, setPollRecordsFunction] = useState(`async function pollRecords() {
  const response = await fetch("https://jsonplaceholder.typicode.com/users", {
    method: "GET",
    headers: {},
  });
  return await response.json();
}`);

  const [response, setResponse] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [gridSelection, setGridSelection] = useState<
    GridSelection | undefined
  >();
  const [pathModalOpened, setPathModalOpened] = useState(false);
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState<any[] | null>(null);

  // State for record array path selection
  const [recordArrayPath, setRecordArrayPath] = useState<string>("");
  const [recordArrayPathModalOpened, setRecordArrayPathModalOpened] =
    useState(false);
  const [availableArrayPaths, setAvailableArrayPaths] = useState<string[]>([]);

  // State for ID path selection
  const [idPath, setIdPath] = useState<string>("");
  const [idPathModalOpened, setIdPathModalOpened] = useState(false);

  // New state for dynamic field mappings
  const [mappings, setMappings] = useState<MappingRow[]>([
    { id: "mapping-0", destination: "", source: "", pgType: "text" },
  ]);
  const [currentMappingId, setCurrentMappingId] = useState<string | null>(null);

  // State for delete functionality
  const [deleteFunction, setDeleteFunction] = useState("");
  const [selectedDeleteId, setSelectedDeleteId] = useState<string>("");
  const { trigger: generateDeleteFunction } = useGenerateDeleteRecord();

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
      // Populate the AI prompt - always set to table's prompt value (could be null/undefined)
      setAiPrompt(selectedTable.prompt || "");
      
      // Populate the API key
      setApiKey(selectedTable.apiKey || "");
      
      // Populate the fetch configuration
      if (selectedTable.pollRecords) {
        setPollRecordsFunction(selectedTable.pollRecords);
      }
      
      // Populate the mapping configuration
      if (selectedTable.mapping && typeof selectedTable.mapping === 'object') {
        const mapping = selectedTable.mapping as any;
        if (mapping.recordArrayPath) {
          setRecordArrayPath(mapping.recordArrayPath);
        }
        if (mapping.idPath) {
          setIdPath(mapping.idPath);
        }
        if (mapping.fields && Array.isArray(mapping.fields)) {
          const newMappings: MappingRow[] = mapping.fields.map((field: any, index: number) => ({
            id: `mapping-${index}`,
            destination: field.name,
            source: field.path,
            pgType: field.type,
          }));
          setMappings(newMappings);
          nextMappingId.current = newMappings.length;
        }
      }
      
      // Set the table name
      setTableName(selectedTable.name);
      
      // Load saved response data if it exists
      if (selectedTable.pollRecordsResponse) {
        setResponse(selectedTable.pollRecordsResponse as any);
      } else {
        setResponse(null);
      }
      
      // Load saved delete function if it exists
      if (selectedTable.deleteRecord) {
        setDeleteFunction(selectedTable.deleteRecord);
      } else {
        setDeleteFunction("");
      }
      
      // Clear mapped data when selecting an existing table
      setResult(null);
    }
  }, [selectedTable]);

  // Handle tab switching after table creation
  const [pendingTabSwitch, setPendingTabSwitch] = useState<string | null>(null);
  
  useEffect(() => {
    console.log('pendingTabSwitch:', pendingTabSwitch);
    console.log('genericTables:', genericTables);
    if (pendingTabSwitch && genericTables) {
      const tableExists = genericTables.some(table => table.id === pendingTabSwitch);
      console.log('tableExists:', tableExists);
      if (tableExists) {
        console.log('Switching to tab:', pendingTabSwitch);
        setSelectedTableId(pendingTabSwitch);
        setPendingTabSwitch(null);
      }
    }
  }, [pendingTabSwitch, genericTables]);

  // Auto-select first table when tables are loaded and no table is selected
  useEffect(() => {
    if (genericTables && genericTables.length > 0 && !selectedTableId) {
      setSelectedTableId(genericTables[0].id);
    }
  }, [genericTables, selectedTableId]);

  // Function to extract all possible array paths from an object
  const extractArrayPaths = useCallback((obj: any, prefix = ""): string[] => {
    const paths: string[] = [];
    if (Array.isArray(obj)) {
      paths.push(prefix || ".");
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

  const save = async (): Promise<void> => {
    if (!selectedTableId) {
      notifications.show({
        title: "No table selected",
        message: "Please select a table to update",
        color: "red",
      });
      return;
    }
    setLoading(true);
    try {
      // Create the fetch configuration from the current pollRecordsFunction (optional)
      // let fetchConfig: any = {};
      // try {
      //   fetchConfig = JSON.parse(pollRecordsFunction);
      // } catch {
      //   // If pollRecordsFunction is invalid JSON, use empty object
      //   fetchConfig = {};
      // }
      
      // Create the mapping configuration from the current mappings (optional)
      const fields = mappings
        .filter((m) => m.destination && m.source)
        .map((m) => ({
          path: m.source,
          type: m.pgType,
          name: m.destination,
        }));

      // Update the existing table with current data
      const updateTableDto: CreateGenericTableDto = {
        name: tableName ,
        pollRecords: pollRecordsFunction.trim() ? pollRecordsFunction : undefined,
        prompt: aiPrompt.trim() ? aiPrompt : undefined,
        apiKey: apiKey.trim() ? apiKey : undefined,
        ...(recordArrayPath && fields.length > 0 && {
          mapping: {
            recordArrayPath,
            idPath: idPath.trim() || undefined,
            fields,
          },
        }),
        ...(response && { pollRecordsResponse: response as unknown as Record<string, unknown> }),
        ...(deleteFunction.trim() && { deleteRecord: deleteFunction }),
      };
      const updatedTable = await updateGenericTable(selectedTableId, updateTableDto);
      notifications.show({
        title: "Table updated successfully",
        message: `Successfully updated table "${updatedTable.name}"!`,
        color: "green",
      });
      // Don't clear the result - keep the mapped data visible
    } catch (err: any) {
      notifications.show({
        title: "Error updating table",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestPollRecords = async (): Promise<void> => {
    setResponse(null);
    setLoading(true);
    try {
      // Make a direct call to the NestJS backend
      const resp = await fetch(process.env.NEXT_PUBLIC_API_URL+"/rest/api-import/execute-poll-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ function: pollRecordsFunction, apiKey }),
      });
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      setResponse(data);
    } catch (err: any) {
      notifications.show({
        title: "Fetch error",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMapping = async (): Promise<void> => {
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

      // Apply regular field mappings
      let mapped = applyMapping(arrayData, fieldMappings);

      // Add ID data if ID path is specified
      if (idPath && idPath.trim()) {
        mapped = mapped.map((item, index) => {
          const idValue = _.get(arrayData[index], idPath);
          return {
            __id: idValue, // Special field for ID column
            ...item,
          };
        });
      }

      setResult(mapped);

      // Create columns with ID column first if ID path is specified
      const newColumns: GridColumn[] = [];
      
      // Add ID column first if ID path is specified
      if (idPath && idPath.trim()) {
        newColumns.push({
          title: "ID",
          id: "__id",
          width: 150,
        });
      }

      // Add regular field columns
      const fieldColumns = mappings
        .filter((m) => m.destination)
        .map((m) => ({
          title: `${m.destination} (${m.pgType})`,
          id: m.destination,
          width: 200,
        }));
      
      newColumns.push(...fieldColumns);
      setColumns(newColumns);
    } catch (err: any) {
      notifications.show({
        title: "Mapping error",
        message: err.message,
        color: "red",
      });
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
      
      // Special styling for ID column
      if (colId === "__id") {
        return {
          kind: GridCellKind.Text,
          data: displayValue,
          displayData: displayValue,
          allowOverlay: true,
          readonly: false,
        };
      }
      
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
    setLoading(true);
    try {
      // Make a direct call to the NestJS backend
      const resp = await fetch(
        process.env.NEXT_PUBLIC_API_URL+"/rest/api-import/generate-poll-records",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: aiPrompt }),
        }
      );
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      setPollRecordsFunction(data.function);
      setAiPrompt("");
    } catch (err: any) {
      notifications.show({
        title: "AI generation failed",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDeleteFunction = async (): Promise<void> => {
    if (!aiPrompt.trim()) {
      notifications.show({
        title: "AI Prompt Required",
        message: "Please enter a description in step 1 first.",
        color: "red",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await generateDeleteFunction({ prompt: aiPrompt });
      setDeleteFunction(result.function);
      notifications.show({
        title: "Delete Function Generated",
        message: "AI has generated a delete function based on your description.",
        color: "green",
      });
    } catch (err: any) {
      notifications.show({
        title: "Generation Failed",
        message: err.message,
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (): Promise<void> => {
    if (!selectedDeleteId) {
      notifications.show({
        title: "No ID Selected",
        message: "Please select an ID to delete.",
        color: "red",
      });
      return;
    }

    notifications.show({
      title: "Delete Not Implemented",
      message: "Delete functionality is not yet implemented.",
      color: "yellow",
    });
  };

  return (
    <Container size="xl" py="xl" style={{ position: "relative" }}>
      {loading && (
        <Box
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(255,255,255,0.6)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Center style={{ width: "100vw", height: "100vh" }}>
            <Loader size={64} color="blue" />
          </Center>
        </Box>
      )}
      <Stack gap="md">
        {/* Top action buttons */}
        <Group justify="space-between" align="center">
          <Button
            variant="light"
            onClick={() => {
              setTableNameModalOpened(true);
              setNewTableName("");
            }}
            leftSection={<Plus size={16} />}
          >
            Create New Table
          </Button>
          <Group gap="sm">
            <Button
              variant="outline"
              color="red"
              onClick={async () => {
                if (!selectedTableId) {
                  notifications.show({
                    title: "No table selected",
                    message: "Please select a table to delete",
                    color: "red",
                  });
                  return;
                }
                if (confirm(`Are you sure you want to delete the table "${selectedTable?.name}"? This action cannot be undone.`)) {
                  setLoading(true);
                  try {
                    await deleteGenericTable(selectedTableId);
                    notifications.show({
                      title: "Table deleted",
                      message: `Successfully deleted table "${selectedTable?.name}"`,
                      color: "green",
                    });
                    setSelectedTableId(null);
                  } catch (err: any) {
                    notifications.show({
                      title: "Error deleting table",
                      message: err.message,
                      color: "red",
                    });
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              loading={loading}
              disabled={!selectedTableId}
              leftSection={<Trash size={16} />}
            >
              Delete
            </Button>
            <Button
              variant="filled"
              onClick={save}
              loading={loading}
              disabled={!selectedTableId}
            >
              Save
            </Button>
          </Group>
        </Group>

        {/* Tabs for table selection */}
        {genericTables && genericTables.length > 0 ? (
          <Tabs 
            key={selectedTableId} 
            value={selectedTableId} 
            onChange={(value) => {
              console.log('Tab changed to:', value);
              setSelectedTableId(value);
            }}
          >
            <Tabs.List>
              {genericTables.map((table) => (
                <Tabs.Tab key={table.id} value={table.id} disabled={tablesLoading}>
                  {table.name}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        ) : (
          <Center py="xl">
            <Text size="lg" c="dimmed">
              Select table or create a new one
            </Text>
          </Center>
        )}

        {/* Main content area */}
        {genericTables && genericTables.length > 0 && (
          <Accordion defaultValue={["step1", "step2", "step3", "step4"]} variant="contained" multiple>
            {/* Step 1: Describe the data you are trying to import */}
            <Accordion.Item value="step1">
              <Accordion.Control>
                <Group gap="xs" align="center">
                  <Text size="lg" fw={600}>
                    1. Describe the data you are trying to import
                  </Text>
                  <Tooltip label="Use AI to automatically generate a JavaScript function for fetching records. This can help you quickly set up API calls without manually writing code.">
                    <Text size="sm" c="dimmed">
                      (What is AI generation?)
                    </Text>
                  </Tooltip>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="md">
                  <Text size="sm" fw={500}>
                    Describe the data or provide a link to the resource
                  </Text>
                  <Textarea
                    placeholder="I want to work with data from my Airtable base with id: 123, table id: 456"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    styles={{ input: { height: "120px" } }}
                  />
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>
                      API key / token
                    </Text>
                    <TextInput
                      placeholder="Enter your API key or token"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      type="password"
                    />
                    <Button
                      variant="light"
                      size="sm"
                      leftSection={<Sparkle size={16} />}
                      onClick={() => {
                        // TODO: Implement "I am feeling lucky" functionality
                      }}
                      style={{ width: "fit-content" }}
                    >
                      I am feeling lucky
                    </Button>
                  </Stack>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {/* Step 2: Configure Record Polling */}
            <Accordion.Item value="step2">
              <Accordion.Control>
                <Group gap="xs" align="center">
                  <Text size="lg" fw={600}>
                    2. Configure Record Polling
                  </Text>
                  <Tooltip label="Polling refers to the process of periodically checking for updates or new data from a source. This is typically used for real-time data or when you need to refresh data at regular intervals.">
                    <Text size="sm" c="dimmed">
                      (What is polling?)
                    </Text>
                  </Tooltip>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Group align="flex-start" gap="md">
                    <Stack style={{ flex: 1 }} gap="sm">
                      <Textarea
                        label="Poll Records Function"
                        placeholder='async function pollRecords() { ... }'
                        value={pollRecordsFunction}
                        onChange={(e) => setPollRecordsFunction(e.target.value)}
                        styles={{
                          input: {
                            fontFamily: "monospace",
                            fontSize: "12px",
                            height: "400px",
                          },
                        }}
                      />
                      <Button
                        leftSection={<Sparkle size={16} />}
                        onClick={handleAiGenerate}
                        loading={loading}
                        disabled={!aiPrompt.trim()}
                        size="sm"
                        variant="light"
                        style={{ width: "fit-content" }}
                      >
                        Generate Poll Records Function
                      </Button>
                    </Stack>
                    <Stack style={{ flex: 1 }} gap="sm">
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
                      <Button
                        onClick={handleTestPollRecords}
                        disabled={!pollRecordsFunction.trim()}
                        leftSection={<ArrowRight size={16} />}
                        style={{ width: "fit-content" }}
                      >
                        Test Poll Records
                      </Button>
                    </Stack>
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {/* Step 3: Configure Field Mapping & Apply Mapping */}
            <Accordion.Item value="step3">
              <Accordion.Control>
                <Group gap="xs" align="center">
                  <Text size="lg" fw={600}>
                    3. Configure Field Mapping & Apply Mapping
                  </Text>
                  <Tooltip label="Field mapping allows you to transform data from your API response into the format you need for your database. This includes selecting the array path and mapping individual fields.">
                    <Text size="sm" c="dimmed">
                      (What is field mapping?)
                    </Text>
                  </Tooltip>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Group align="flex-start" gap="md">
                    <Stack style={{ flex: 1 }} gap="sm">
                      {/* Record Array Path Selection */}
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>
                          Where are your records located in the response?
                        </Text>
                        <Group gap="xs" align="center">
                          <Text size="sm" fw={500}>
                            Selected path:
                          </Text>
                          <TextInput
                            placeholder="Enter path or use . for root array"
                            value={recordArrayPath}
                            onChange={(e) => setRecordArrayPath(e.target.value)}
                            style={{ flex: 1 }}
                            styles={{
                              input: {
                                fontFamily: "monospace",
                                fontSize: "12px",
                              },
                            }}
                          />
                          <Button
                            variant="light"
                            size="xs"
                            onClick={() => {
                              if (!response) {
                                notifications.show({
                                  title: "No data available",
                                  message: "Please fetch data first to see available paths. Click 'Fetch Data' in step 2.",
                                  color: "red",
                                });
                                return;
                              }
                              const paths = extractArrayPaths(response);
                              setAvailableArrayPaths(paths);
                              setRecordArrayPathModalOpened(true);
                            }}
                          >
                            Browse Paths
                          </Button>
                        </Group>
                      </Stack>

                      {/* ID Path Selection */}
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>
                          ID field path (optional):
                        </Text>
                        <Group gap="xs" align="center">
                          <Text size="sm" fw={500}>
                            ID path:
                          </Text>
                          <TextInput
                            placeholder="Enter ID path or leave empty"
                            value={idPath}
                            onChange={(e) => setIdPath(e.target.value)}
                            style={{ flex: 1 }}
                            styles={{
                              input: {
                                fontFamily: "monospace",
                                fontSize: "12px",
                              },
                            }}
                          />
                          <Button
                            variant="light"
                            size="xs"
                            onClick={() => {
                              if (!response) {
                                notifications.show({
                                  title: "No data available",
                                  message: "Please fetch data first to see available paths. Click 'Fetch Data' in step 2.",
                                  color: "red",
                                });
                                return;
                              }
                              const arrayData = recordArrayPath === "." ? response : _.get(response, recordArrayPath);
                              if (!Array.isArray(arrayData)) {
                                notifications.show({
                                  title: "Invalid array path",
                                  message: "The selected record array path does not point to an array.",
                                  color: "red",
                                });
                                return;
                              }
                              const paths = extractAllPathsFromArray(arrayData);
                              setAvailablePaths(paths);
                              setIdPathModalOpened(true);
                            }}
                          >
                            Browse Paths
                          </Button>
                        </Group>
                      </Stack>

                      {/* Field Mappings */}
                      <Stack gap="xs">
                        <Text size="sm" fw={500}>
                          Map individual fields from API response to database columns:
                        </Text>
                        {mappings.map((mapping) => (
                          <Group key={mapping.id} gap="xs">
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => {
                                if (!response) {
                                  notifications.show({
                                    title: "No data available",
                                    message: "Please fetch data first to see available paths. Click 'Fetch Data' in step 2.",
                                    color: "red",
                                  });
                                  return;
                                }
                                openPathModal(mapping.id);
                              }}
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
                            />
                            <Text size="sm">→</Text>
                            <TextInput
                              placeholder="Destination field name"
                              value={mapping.destination}
                              onChange={(e) =>
                                handleMappingChange(mapping.id, "destination", e.target.value)
                              }
                              style={{ flex: 1 }}
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
                            />
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => removeMappingRow(mapping.id)}
                              disabled={mappings.length === 1}
                            >
                              <Trash size={16} />
                            </ActionIcon>
                          </Group>
                        ))}
                        <Button
                          variant="light"
                          size="sm"
                          leftSection={<Plus size={16} />}
                          onClick={addMappingRow}
                          style={{ width: "fit-content" }}
                        >
                          Add Field Mapping
                        </Button>
                      </Stack>

                    </Stack>

                    <Stack style={{ flex: 1 }} gap="sm">
                      <Stack gap="xs">
                        <Group justify="space-between" align="center">
                          <Text size="sm" fw={500}>
                            Mapped Data Preview:
                          </Text>
                          {result && result.length > 0 && (
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
                          )}
                        </Group>
                        <Box style={{ flexGrow: 1, height: 400 }}>
                          <DataEditor
                            columns={result && result.length > 0 ? columns : []}
                            rows={result && result.length > 0 ? result.length : 1}
                            getCellContent={result && result.length > 0 ? getCellContent : () => ({ kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false })}
                            onCellEdited={result && result.length > 0 ? onCellEdited : undefined}
                            onDelete={result && result.length > 0 ? onDelete : undefined}
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
                      
                      <Button
                        onClick={handleApplyMapping}
                        disabled={!response || mappings.length === 0}
                        leftSection={<ArrowRight size={16} />}
                        style={{ width: "140px" }}
                      >
                        Apply Mapping
                      </Button>
                    </Stack>
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>

            {/* Step 4: Generate Delete Functionality */}
            <Accordion.Item value="step4">
              <Accordion.Control>
                <Group gap="xs" align="center">
                  <Text size="lg" fw={600}>
                    4. Generate Delete Functionality
                  </Text>
                  <Tooltip label="Generate a JavaScript function that can delete records from your API. This function will use fetch() to call the delete endpoint with the record ID.">
                    <Text size="sm" c="dimmed">
                      (What is delete functionality?)
                    </Text>
                  </Tooltip>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Group align="flex-start" gap="md">
                    <Stack style={{ flex: 1 }} gap="sm">
                      <Textarea
                        label="Delete Function"
                        placeholder="Enter or generate a JavaScript function for deleting records (e.g., async function deleteRecord(recordId) { ... })"
                        value={deleteFunction}
                        onChange={(e) => setDeleteFunction(e.target.value)}
                        styles={{
                          input: {
                            fontFamily: "monospace",
                            fontSize: "12px",
                            height: "400px",
                          },
                        }}
                      />
                      <Button
                        leftSection={<Sparkle size={16} />}
                        onClick={handleGenerateDeleteFunction}
                        loading={loading}
                        disabled={!aiPrompt.trim()}
                        size="sm"
                        variant="light"
                        style={{ width: "fit-content" }}
                      >
                        Generate Delete Function
                      </Button>
                    </Stack>
                    <Stack style={{ flex: 1 }} gap="sm">
                      <Text size="sm" fw={500}>
                        Test Delete Function:
                      </Text>
                      <Select
                        label="Select ID to Delete"
                        placeholder="Choose an ID from the mapped data above"
                        value={selectedDeleteId}
                        onChange={(value) => setSelectedDeleteId(value || "")}
                        data={
                          result && result.length > 0
                            ? result.map((item: any, index: number) => {
                                const idValue = item.id || item.ID || item.Id || index.toString();
                                return {
                                  value: String(idValue),
                                  label: `${idValue} - ${JSON.stringify(item).substring(0, 50)}...`,
                                };
                              })
                            : []
                        }
                        disabled={!result || result.length === 0}
                      />
                      <Button
                        onClick={handleDeleteRecord}
                        disabled={!selectedDeleteId}
                        leftSection={<Trash size={16} />}
                        color="red"
                        variant="outline"
                        style={{ width: "fit-content" }}
                      >
                        Delete Record
                      </Button>
                      {!result || result.length === 0 ? (
                        <Text size="sm" c="dimmed">
                          No mapped data available. Apply mapping in step 3 first.
                        </Text>
                      ) : null}
                    </Stack>
                  </Group>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        )}
      </Stack>

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

      {/* ID Path Selection Modal */}
      <Modal
        opened={idPathModalOpened}
        onClose={() => setIdPathModalOpened(false)}
        title="Select ID Path"
        size="lg"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Click on a path to use it as the ID field:
          </Text>
          <Stack gap="xs" style={{ maxHeight: "400px", overflowY: "auto" }}>
            {availablePaths.map((path) => (
              <Button
                key={path}
                variant="subtle"
                justify="flex-start"
                onClick={() => {
                  setIdPath(path);
                  setIdPathModalOpened(false);
                }}
                style={{ fontFamily: "monospace", fontSize: "12px" }}
              >
                {path}
              </Button>
            ))}
          </Stack>
        </Stack>
      </Modal>

      {/* Table Name Modal */}
      <Modal
        opened={tableNameModalOpened}
        onClose={() => setTableNameModalOpened(false)}
        title="Create New Table"
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Enter a name for your new table:
          </Text>
          <TextInput
            placeholder="Enter table name"
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            autoFocus
          />
          <Group justify="flex-end" gap="sm">
            <Button
              variant="light"
              onClick={() => setTableNameModalOpened(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newTableName.trim()) {
                  notifications.show({
                    title: "Table name required",
                    message: "Please enter a table name",
                    color: "red",
                  });
                  return;
                }
                setLoading(true);
                try {
                  const createTableDto: CreateGenericTableDto = {
                    name: newTableName.trim(),
                  };
                  const createdTable = await createGenericTable(createTableDto);
                  setTableNameModalOpened(false);
                  setNewTableName("");
                  setSelectedTableId(createdTable.id);
                } catch (err: any) {
                  notifications.show({
                    title: "Error creating table",
                    message: err.message,
                    color: "red",
                  });
                } finally {
                  setLoading(false);
                }
              }}
              loading={loading}
              disabled={!newTableName.trim()}
            >
              Create Table
            </Button>
          </Group>
        </Stack>
      </Modal>
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
