/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCustomConnector, useCustomConnectors } from '@/hooks/use-custom-connector';
import {
  executeCreateRecord,
  executeDeleteRecord,
  executeListTables,
  executeUpdateRecord,
  generateCreateRecord,
  generateDeleteRecord,
  generateListTables,
  generateUpdateRecord,
} from '@/lib/api/api-import';
import { CreateCustomConnectorDto } from '@/types/server-entities/custom-connector';
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
import {
  Accordion,
  ActionIcon,
  Box,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ArrowRight,
  CaretDown,
  CaretUp,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Sparkle,
  Trash,
} from '@phosphor-icons/react';
import _ from 'lodash';
import { FC, useCallback, useEffect, useRef, useState } from 'react';

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
  const [newTableName, setNewTableName] = useState('');

  // GenericTable state
  const {
    data: customConnectors,
    createCustomConnector,
    updateCustomConnector,
    deleteCustomConnector,
    isLoading: connectorsLoading,
  } = useCustomConnectors();
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | null>(null);
  const { data: selectedConnector } = useCustomConnector(selectedConnectorId || '');
  const [connectorName, setConnectorName] = useState('');

  // State for schema generation
  const [fetchSchemaFunction, setFetchSchemaFunction] = useState(`async function fetchSchema() {
  // This is a static schema example
  return [
    { id: "name", displayName: "Name", type: "text" },
    { id: "email", displayName: "Email", type: "text" },
    { id: "age", displayName: "Age", type: "numeric" }
  ];
}`);

  const [schema, setSchema] = useState<any[] | null>(null);

  // State for list tables functionality
  const [listTablesFunction, setListTablesFunction] = useState(`async function listTables(apiKey) {
  // This is a static list tables example
  return [
    { id: ["base1", "table1"], displayName: "Users Table" },
    { id: ["base1", "table2"], displayName: "Products Table" }
  ];
}`);

  const [tables, setTables] = useState<any[] | null>(null);
  const [selectedTableFromList, setSelectedTableFromList] = useState<string[] | null>(null);

  const [pollRecordsFunction, setPollRecordsFunction] = useState(`async function pollRecords() {
  const response = await fetch("https://jsonplaceholder.typicode.com/users", {
    method: "GET",
    headers: {},
  });
  return await response.json();
}`);

  const [response, setResponse] = useState<any[] | null>(null);
  const [columns, setColumns] = useState<GridColumn[]>([]);
  const [gridSelection, setGridSelection] = useState<GridSelection | undefined>();
  const [pathModalOpened, setPathModalOpened] = useState(false);
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [mappedRecords, setMappedRecords] = useState<any[] | null>(null);

  // State for record array path selection
  const [recordArrayPath, setRecordArrayPath] = useState<string>('');
  const [recordArrayPathModalOpened, setRecordArrayPathModalOpened] = useState(false);
  const [availableArrayPaths, setAvailableArrayPaths] = useState<string[]>([]);

  // State for ID path selection
  const [idPath, setIdPath] = useState<string>('');
  const [idPathModalOpened, setIdPathModalOpened] = useState(false);

  // New state for dynamic field mappings
  const [mappings, setMappings] = useState<MappingRow[]>([
    { id: 'mapping-0', destination: '', source: '', pgType: 'text' },
  ]);
  const [currentMappingId, setCurrentMappingId] = useState<string | null>(null);

  // State for delete functionality
  const [deleteFunction, setDeleteFunction] = useState('');
  const [selectedDeleteId, setSelectedDeleteId] = useState<string>('');

  // State for create functionality
  const [createFunction, setCreateFunction] = useState('');
  const [createRecordData, setCreateRecordData] = useState<Record<string, unknown>>({});
  const [createRecordDataText, setCreateRecordDataText] = useState('{}');

  // Update text when createRecordData changes
  useEffect(() => {
    setCreateRecordDataText(JSON.stringify(createRecordData, null, 2));
  }, [createRecordData]);

  // State for update functionality
  const [updateFunction, setUpdateFunction] = useState('');
  const [selectedUpdateId, setSelectedUpdateId] = useState<string>('');
  const [updateRecordData, setUpdateRecordData] = useState<Record<string, unknown>>({});
  const [updateRecordDataText, setUpdateRecordDataText] = useState('{}');

  // Update text when updateRecordData changes
  useEffect(() => {
    setUpdateRecordDataText(JSON.stringify(updateRecordData, null, 2));
  }, [updateRecordData]);

  // State for accordion control
  const [accordionValue, setAccordionValue] = useState<string[]>([
    'step1',
    'step2',
    'step3',
    'step4',
    'step5',
    'step6',
    'step7',
    'step8',
  ]);

  // Expand all accordion items
  const expandAll = () => {
    setAccordionValue(['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8', 'step9']);
  };

  // Collapse all accordion items
  const collapseAll = () => {
    setAccordionValue([]);
  };

  // Function to extract all possible paths from an object
  const extractPaths = useCallback((obj: any, prefix = ''): string[] => {
    const paths: string[] = [];
    if (Array.isArray(obj) && obj.length > 0) {
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

  // Function to extract all possible paths from an array of objects (combining all fields)
  const extractAllPathsFromArray = useCallback(
    (array: any[]): string[] => {
      const allPaths = new Set<string>();

      array.forEach((item) => {
        if (typeof item === 'object' && item !== null) {
          const paths = extractPaths(item);
          paths.forEach((path) => allPaths.add(path));
        }
      });

      return Array.from(allPaths);
    },
    [extractPaths],
  );

  // Update available paths when response changes
  useEffect(() => {
    if (response && recordArrayPath) {
      const arrayData = recordArrayPath === '.' ? response : _.get(response, recordArrayPath);
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
    if (selectedConnector && selectedConnector.id) {
      // Populate the AI prompt - always set to table's prompt value (could be null/undefined)
      setAiPrompt(selectedConnector.prompt || '');

      // Populate the API key
      setApiKey(selectedConnector.apiKey || '');

      // Populate the list tables configuration
      setListTablesFunction(selectedConnector.listTables || '');
      if (selectedConnector.tables && Array.isArray(selectedConnector.tables)) {
        const parsedTables = selectedConnector.tables.map((tableId: string) => {
          const parts = tableId.split(':');
          return {
            id: parts,
            displayName: `Table ${parts.join(' - ')}`,
          };
        });
        setTables(parsedTables);
      } else {
        setTables(null);
      }

      // Populate the schema configuration
      setFetchSchemaFunction(selectedConnector.fetchSchema || '');
      setSchema((selectedConnector.schema as any[]) || null);

      // Populate the fetch configuration
      if (selectedConnector.pollRecords) {
        setPollRecordsFunction(selectedConnector.pollRecords);
      }

      // Populate the mapping configuration
      if (selectedConnector.mapping && typeof selectedConnector.mapping === 'object') {
        const mapping = selectedConnector.mapping as any;
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
      setConnectorName(selectedConnector.name);

      // Load saved response data if it exists
      if (selectedConnector.pollRecordsResponse) {
        setResponse(selectedConnector.pollRecordsResponse as any);
      } else {
        setResponse(null);
      }

      // Load saved delete function if it exists
      if (selectedConnector.deleteRecord) {
        setDeleteFunction(selectedConnector.deleteRecord);
      } else {
        setDeleteFunction('');
      }

      // Load saved create function if it exists
      if (selectedConnector.createRecord) {
        setCreateFunction(selectedConnector.createRecord);
      } else {
        setCreateFunction('');
      }

      // Initialize create record data text
      setCreateRecordDataText(JSON.stringify(createRecordData, null, 2));

      // Load saved update function if it exists
      if (selectedConnector.updateRecord) {
        setUpdateFunction(selectedConnector.updateRecord);
      } else {
        setUpdateFunction('');
      }

      // Clear mapped data when selecting an existing table
      setMappedRecords(null);
    }
  }, [
    selectedConnector?.id,
    selectedConnector?.listTables,
    selectedConnector?.tables,
    selectedConnector?.pollRecords,
    selectedConnector?.fetchSchema,
    selectedConnector?.schema,
    selectedConnector?.mapping,
    selectedConnector?.pollRecordsResponse,
    selectedConnector?.deleteRecord,
    selectedConnector?.createRecord,
    selectedConnector?.updateRecord,
    selectedConnector?.prompt,
    selectedConnector?.apiKey,
    selectedConnector?.name,
    createRecordData,
  ]);

  // Handle tab switching after table creation
  const [pendingTabSwitch, setPendingTabSwitch] = useState<string | null>(null);

  useEffect(() => {
    if (pendingTabSwitch && customConnectors) {
      const connectorExists = customConnectors.some((connector) => connector.id === pendingTabSwitch);
      if (connectorExists) {
        setSelectedConnectorId(pendingTabSwitch);
        setPendingTabSwitch(null);
      }
    }
  }, [pendingTabSwitch, customConnectors]);

  // Auto-select first table when tables are loaded and no table is selected
  useEffect(() => {
    if (customConnectors && customConnectors.length > 0 && !selectedConnectorId) {
      setSelectedConnectorId(customConnectors[0].id);
    }
  }, [customConnectors, selectedConnectorId]);

  // Function to extract all possible array paths from an object
  const extractArrayPaths = useCallback((obj: any, prefix = ''): string[] => {
    const paths: string[] = [];
    if (Array.isArray(obj)) {
      paths.push(prefix || '.');
    } else if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach((key) => {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];
        if (Array.isArray(value)) {
          paths.push(newPrefix);
        } else if (typeof value === 'object' && value !== null) {
          paths.push(...extractArrayPaths(value, newPrefix));
        }
      });
    }
    return paths;
  }, []);

  const save = async (): Promise<void> => {
    if (!selectedConnectorId) {
      notifications.show({
        title: 'No table selected',
        message: 'Please select a table to update',
        color: 'red',
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
      const updateConnectorDto: CreateCustomConnectorDto = {
        name: connectorName,
        pollRecords: pollRecordsFunction.trim() ? pollRecordsFunction : undefined,
        prompt: aiPrompt.trim() ? aiPrompt : undefined,
        apiKey: apiKey.trim() ? apiKey : undefined,
        listTables: listTablesFunction.trim() ? listTablesFunction : undefined,
        tables: tables ? tables.map((table: any) => table.id.join(':')) : [],
        ...(fetchSchemaFunction.trim() && { fetchSchema: fetchSchemaFunction }),
        ...(schema && { schema: schema as unknown as Record<string, unknown> }),
        ...(recordArrayPath &&
          fields.length > 0 && {
            mapping: {
              recordArrayPath,
              idPath: idPath.trim() || undefined,
              fields,
            },
          }),
        ...(response && { pollRecordsResponse: response as unknown as Record<string, unknown> }),
        ...(deleteFunction.trim() && { deleteRecord: deleteFunction }),
        ...(createFunction.trim() && { createRecord: createFunction }),
        ...(updateFunction.trim() && { updateRecord: updateFunction }),
      };
      const updatedConnector = await updateCustomConnector(selectedConnectorId, updateConnectorDto);
      notifications.show({
        title: 'Table updated successfully',
        message: `Successfully updated table "${updatedConnector.name}"!`,
        color: 'green',
      });
      // Don't clear the result - keep the mapped data visible
    } catch (err: any) {
      notifications.show({
        title: 'Error updating table',
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestPollRecords = async (): Promise<void> => {
    setResponse(null);
    setLoading(true);
    try {
      if (!selectedTableFromList) {
        notifications.show({
          title: 'No table selected',
          message: 'Please select a table from the list in step 2 first.',
          color: 'red',
        });
        return;
      }

      // Make a direct call to the NestJS backend
      const resp = await fetch(
        process.env.NEXT_PUBLIC_API_URL + '/rest/custom-connector-builder/execute-poll-records',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ function: pollRecordsFunction, apiKey, tableId: selectedTableFromList }),
        },
      );
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      setResponse(data);
    } catch (err: any) {
      notifications.show({
        title: 'Fetch error',
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyMapping = async (): Promise<void> => {
    try {
      if (!response) throw new Error('No API response available.');
      if (!schema || !Array.isArray(schema) || schema.length === 0) throw new Error('No schema available.');

      // Response is always an array of records with {id, fields} structure
      if (!Array.isArray(response)) throw new Error('Response is not an array.');

      // Filter to only valid records
      const mapped = response.filter(
        (item) => item && typeof item.id === 'string' && typeof item.fields === 'object' && item.fields !== null,
      );
      setMappedRecords(mapped);

      // Columns: ID column first, then columns from schema
      const newColumns: GridColumn[] = [
        {
          title: 'ID',
          id: '__id',
          width: 150,
        },
        ...schema.map((col: any) => ({
          title: col.displayName || col.id,
          id: col.id,
          width: 200,
        })),
      ];
      setColumns(newColumns);
    } catch (err: any) {
      notifications.show({
        title: 'Mapping error',
        message: err.message,
        color: 'red',
      });
    }
  };

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      if (!mappedRecords || !mappedRecords[row] || !columns[col]) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
          readonly: true,
        };
      }
      const record = mappedRecords[row];
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
      let cellData = '';
      if (colId === '__id') {
        cellData = record.id;
      } else {
        // Map column ID to field key - they should match
        cellData = record.fields ? record.fields[colId] : '';
      }
      const displayValue = String(cellData ?? '');

      return {
        kind: GridCellKind.Text,
        data: displayValue,
        displayData: displayValue,
        allowOverlay: true,
        readonly: false,
      };
    },
    [mappedRecords, columns],
  );

  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const column = columns[col];
      const colId = column.id;
      if (colId === undefined) return;
      setMappedRecords((r) => {
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
      if (!mappedRecords || !selection.rows) return false;
      setMappedRecords((r) => {
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
    [mappedRecords],
  );

  const openPathModal = (mappingId: string): void => {
    setCurrentMappingId(mappingId);
    setPathModalOpened(true);
  };

  const handleMappingChange = (id: string, field: 'destination' | 'source' | 'pgType', value: string) => {
    setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const addMappingRow = () => {
    setMappings((prev) => [
      ...prev,
      { id: `mapping-${nextMappingId.current++}`, destination: '', source: '', pgType: 'text' },
    ]);
  };

  const removeMappingRow = (id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
  };

  const handleGenerateSchema = async (): Promise<void> => {
    if (!aiPrompt.trim()) return;
    setLoading(true);
    try {
      // Make a direct call to the NestJS backend
      const resp = await fetch(process.env.NEXT_PUBLIC_API_URL + '/rest/custom-connector-builder/generate-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      setFetchSchemaFunction(data.function);
    } catch (err: any) {
      notifications.show({
        title: 'Schema generation failed',
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestSchema = async (): Promise<void> => {
    setSchema(null);
    setLoading(true);
    try {
      if (!selectedTableFromList) {
        notifications.show({
          title: 'No table selected',
          message: 'Please select a table from the list in step 2 first.',
          color: 'red',
        });
        return;
      }

      // Make a direct call to the NestJS backend
      const resp = await fetch(process.env.NEXT_PUBLIC_API_URL + '/rest/custom-connector-builder/execute-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ functionString: fetchSchemaFunction, apiKey, tableId: selectedTableFromList }),
      });
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      setSchema(data);
    } catch (err: any) {
      notifications.show({
        title: 'Schema test failed',
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAiGenerate = async (): Promise<void> => {
    if (!aiPrompt.trim()) return;
    setLoading(true);
    try {
      // Make a direct call to the NestJS backend
      const resp = await fetch(
        process.env.NEXT_PUBLIC_API_URL + '/rest/custom-connector-builder/generate-poll-records',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: aiPrompt }),
        },
      );
      if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
      const data = await resp.json();
      setPollRecordsFunction(data.function);
    } catch (err: any) {
      notifications.show({
        title: 'AI generation failed',
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDeleteFunction = async (): Promise<void> => {
    if (!aiPrompt.trim()) {
      notifications.show({
        title: 'AI Prompt Required',
        message: 'Please enter a description in step 1 first.',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await generateDeleteRecord(aiPrompt);
      setDeleteFunction(result);
      notifications.show({
        title: 'Delete Function Generated',
        message: 'AI has generated a delete function based on your description.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Generation Failed',
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (): Promise<void> => {
    if (!selectedDeleteId) {
      notifications.show({
        title: 'No ID Selected',
        message: 'Please select an ID to delete.',
        color: 'red',
      });
      return;
    }

    if (!deleteFunction.trim()) {
      notifications.show({
        title: 'No Delete Function',
        message: 'Please generate or enter a delete function first.',
        color: 'red',
      });
      return;
    }

    if (!selectedTableFromList) {
      notifications.show({
        title: 'No table selected',
        message: 'Please select a table from the list in step 2 first.',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      await executeDeleteRecord(deleteFunction, selectedDeleteId, apiKey, selectedTableFromList);

      notifications.show({
        title: 'Delete successful',
        message: 'Successfully deleted record',
        color: 'green',
      });

      // Remove the deleted record from the mapped records
      setMappedRecords((prev) => {
        if (!prev) return prev;
        return prev.filter((record: any) => {
          const recordId = record.id || record.ID || record.Id || record.__id;
          return String(recordId) !== selectedDeleteId;
        });
      });

      // Clear the selected ID
      setSelectedDeleteId('');
    } catch (err: any) {
      notifications.show({
        title: 'Delete Failed',
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateListTables = async (): Promise<void> => {
    if (!aiPrompt.trim()) {
      notifications.show({
        title: 'AI Prompt Required',
        message: 'Please enter a description in step 1 first.',
        color: 'red',
      });
      return;
    }

    setLoading(true);
    try {
      const result = await generateListTables(aiPrompt);
      setListTablesFunction(result);
      notifications.show({
        title: 'List Tables Function Generated',
        message: 'AI has generated a list tables function based on your description.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Generation Failed',
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestListTables = async (): Promise<void> => {
    setTables(null);
    setLoading(true);
    try {
      const data = await executeListTables(listTablesFunction, apiKey);
      setTables(data as any[]);
      notifications.show({
        title: 'List Tables Successful',
        message: 'Successfully retrieved list of tables.',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'List Tables Failed',
        message: err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky top section */}
      <Box
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'white',
          borderBottom: '1px solid #e0e0e0',
          padding: '16px 0',
        }}
      >
        <Container size="xl">
          <Stack gap="md">
            {/* Top action buttons */}
            <Group justify="space-between" align="center">
              <Button
                variant="light"
                onClick={() => {
                  setTableNameModalOpened(true);
                  setNewTableName('');
                }}
                leftSection={<Plus size={16} />}
              >
                Create New Connector
              </Button>
              <Group gap="sm">
                <Button
                  variant="outline"
                  color="red"
                  onClick={async () => {
                    if (!selectedConnectorId) {
                      notifications.show({
                        title: 'No table selected',
                        message: 'Please select a table to delete',
                        color: 'red',
                      });
                      return;
                    }
                    if (
                      confirm(
                        `Are you sure you want to delete the table "${selectedConnector?.name}"? This action cannot be undone.`,
                      )
                    ) {
                      setLoading(true);
                      try {
                        await deleteCustomConnector(selectedConnectorId);
                        notifications.show({
                          title: 'Table deleted',
                          message: `Successfully deleted table "${selectedConnector?.name}"`,
                          color: 'green',
                        });
                        setSelectedConnectorId(null);
                      } catch (err: any) {
                        notifications.show({
                          title: 'Error deleting table',
                          message: err.message,
                          color: 'red',
                        });
                      } finally {
                        setLoading(false);
                      }
                    }
                  }}
                  loading={loading}
                  disabled={!selectedConnectorId}
                  leftSection={<Trash size={16} />}
                >
                  Delete
                </Button>
                <Button variant="filled" onClick={save} loading={loading} disabled={!selectedConnectorId}>
                  Save
                </Button>
              </Group>
            </Group>

            {/* Tabs for table selection */}
            {customConnectors && customConnectors.length > 0 ? (
              <Group justify="space-between" align="center">
                <Tabs
                  key={selectedConnectorId}
                  value={selectedConnectorId}
                  onChange={(value) => {
                    setSelectedConnectorId(value);
                  }}
                >
                  <Tabs.List>
                    {customConnectors.map((connector) => (
                      <Tabs.Tab key={connector.id} value={connector.id} disabled={connectorsLoading}>
                        {connector.name}
                      </Tabs.Tab>
                    ))}
                  </Tabs.List>
                </Tabs>
                <Group gap="xs">
                  <Button variant="light" size="xs" onClick={expandAll} leftSection={<CaretDown size={16} />}>
                    Expand All
                  </Button>
                  <Button variant="light" size="xs" onClick={collapseAll} leftSection={<CaretUp size={16} />}>
                    Collapse All
                  </Button>
                </Group>
              </Group>
            ) : (
              <Center py="xl">
                <Text size="lg" c="dimmed">
                  Select table or create a new one
                </Text>
              </Center>
            )}
          </Stack>
        </Container>
      </Box>

      {/* Scrollable content section */}
      <Box style={{ flex: 1, overflow: 'auto' }}>
        <Container size="xl" py="xl" style={{ position: 'relative' }}>
          {loading && (
            <Box
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(255,255,255,0.6)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Center style={{ width: '100vw', height: '100vh' }}>
                <Loader size={64} color="blue" />
              </Center>
            </Box>
          )}
          <Stack gap="md">
            {/* Main content area */}
            {customConnectors && customConnectors.length > 0 && (
              <Accordion value={accordionValue} onChange={setAccordionValue} variant="contained" multiple>
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
                        styles={{ input: { height: '120px' } }}
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
                          style={{ width: 'fit-content' }}
                        >
                          I am feeling lucky
                        </Button>
                      </Stack>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Step 2: List Tables */}
                <Accordion.Item value="step2">
                  <Accordion.Control>
                    <Group gap="xs" align="center">
                      <Text size="lg" fw={600}>
                        2. List Available Tables
                      </Text>
                      <Tooltip label="Generate a function to list all available tables from your API. This will help you select which table to work with.">
                        <Text size="sm" c="dimmed">
                          (What is list tables?)
                        </Text>
                      </Tooltip>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Group align="flex-start" gap="md">
                        <Stack style={{ flex: 1 }} gap="sm">
                          <Textarea
                            label="List Tables Function"
                            placeholder="async function listTables(apiKey) { ... }"
                            value={listTablesFunction}
                            onChange={(e) => setListTablesFunction(e.target.value)}
                            styles={{
                              input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '400px',
                              },
                            }}
                          />
                          <Button
                            leftSection={<Sparkle size={16} />}
                            onClick={handleGenerateListTables}
                            loading={loading}
                            disabled={!aiPrompt.trim()}
                            size="sm"
                            variant="light"
                            style={{ width: 'fit-content' }}
                          >
                            Generate List Tables Function
                          </Button>
                        </Stack>
                        <Stack style={{ flex: 1 }} gap="sm">
                          <Textarea
                            label="Available Tables"
                            value={
                              tables
                                ? JSON.stringify(tables, null, 2)
                                : 'No tables yet. Click "Test List Tables" to get started.'
                            }
                            styles={{
                              input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '400px',
                              },
                            }}
                            readOnly
                          />
                          <Button
                            onClick={handleTestListTables}
                            disabled={!listTablesFunction.trim()}
                            leftSection={<ArrowRight size={16} />}
                            style={{ width: 'fit-content' }}
                          >
                            Test List Tables
                          </Button>
                          {tables && tables.length > 0 && (
                            <Stack gap="xs">
                              <Text size="sm" fw={500}>
                                Select a table to work with:
                              </Text>
                              <Select
                                placeholder="Choose a table from the list above"
                                value={selectedTableFromList ? selectedTableFromList.join(':') : null}
                                onChange={(value) => {
                                  if (value) {
                                    setSelectedTableFromList(value.split(':'));
                                  } else {
                                    setSelectedTableFromList(null);
                                  }
                                }}
                                data={tables.map((table: any) => ({
                                  value: table.id.join(':'),
                                  label: table.displayName,
                                }))}
                              />
                            </Stack>
                          )}
                        </Stack>
                      </Group>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Step 3: Generate Table Schema */}
                <Accordion.Item value="step3">
                  <Accordion.Control>
                    <Group gap="xs" align="center">
                      <Text size="lg" fw={600}>
                        3. Configure Schema Fetching
                      </Text>
                      <Tooltip label="Generate a schema that defines the structure of your table. This includes field names, types, and how they should be stored in the database.">
                        <Text size="sm" c="dimmed">
                          (What is schema generation?)
                        </Text>
                      </Tooltip>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      {!selectedTableFromList && (
                        <Text size="sm" c="orange" fw={500}>
                          ⚠️ Please select a table from step 2 before testing the schema function.
                        </Text>
                      )}
                      <Group align="flex-start" gap="md">
                        <Stack style={{ flex: 1 }} gap="sm">
                          <Textarea
                            label="Schema Generation Function"
                            placeholder="async function fetchSchema() { ... }"
                            value={fetchSchemaFunction}
                            onChange={(e) => setFetchSchemaFunction(e.target.value)}
                            styles={{
                              input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '400px',
                              },
                            }}
                          />
                          <Button
                            leftSection={<Sparkle size={16} />}
                            onClick={handleGenerateSchema}
                            loading={loading}
                            disabled={!aiPrompt.trim()}
                            size="sm"
                            variant="light"
                            style={{ width: 'fit-content' }}
                          >
                            Generate Schema Function
                          </Button>
                        </Stack>
                        <Stack style={{ flex: 1 }} gap="sm">
                          <Textarea
                            label="Generated Schema"
                            value={
                              schema
                                ? JSON.stringify(schema, null, 2)
                                : "No schema yet. Click 'Test Schema' to get started."
                            }
                            styles={{
                              input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '400px',
                              },
                            }}
                            readOnly
                          />
                          <Button
                            onClick={handleTestSchema}
                            disabled={!fetchSchemaFunction.trim()}
                            leftSection={<ArrowRight size={16} />}
                            style={{ width: 'fit-content' }}
                          >
                            Test Schema
                          </Button>
                        </Stack>
                      </Group>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Step 4: Configure Record Polling */}
                <Accordion.Item value="step4">
                  <Accordion.Control>
                    <Group gap="xs" align="center">
                      <Text size="lg" fw={600}>
                        4. Configure Record Polling
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
                      {!selectedTableFromList && (
                        <Text size="sm" c="orange" fw={500}>
                          ⚠️ Please select a table from step 2 before testing the poll records function.
                        </Text>
                      )}
                      <Group align="flex-start" gap="md">
                        <Stack style={{ flex: 1 }} gap="sm">
                          <Textarea
                            label="Poll Records Function"
                            placeholder="async function pollRecords() { ... }"
                            value={pollRecordsFunction}
                            onChange={(e) => setPollRecordsFunction(e.target.value)}
                            styles={{
                              input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '400px',
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
                            style={{ width: 'fit-content' }}
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
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '400px',
                              },
                            }}
                            readOnly
                          />
                          <Button
                            onClick={handleTestPollRecords}
                            disabled={!pollRecordsFunction.trim()}
                            leftSection={<ArrowRight size={16} />}
                            style={{ width: 'fit-content' }}
                          >
                            Test Poll Records
                          </Button>
                        </Stack>
                      </Group>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Step 5: Preview Records */}
                <Accordion.Item value="step5">
                  <Accordion.Control>
                    <Group gap="xs" align="center">
                      <Text size="lg" fw={600}>
                        5. Preview Records
                      </Text>
                      <Tooltip label="Preview your API data transformed using the schema. This shows you how your data will look after transformation.">
                        <Text size="sm" c="dimmed">
                          (What is preview records?)
                        </Text>
                      </Tooltip>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Text size="sm" fw={500}>
                        Preview your transformed data:
                      </Text>
                      <Button
                        onClick={handleApplyMapping}
                        disabled={!response || !schema || !Array.isArray(schema) || schema.length === 0}
                        leftSection={<ArrowRight size={16} />}
                        style={{ width: '140px' }}
                      >
                        Preview Records
                      </Button>

                      {mappedRecords && mappedRecords.length > 0 && (
                        <Stack gap="xs">
                          <Group justify="space-between" align="center">
                            <Text size="sm" fw={500}>
                              Records Preview:
                            </Text>
                            <Group gap="xs">
                              <Button
                                size="xs"
                                variant="outline"
                                color="red"
                                onClick={() => onDelete(gridSelection!)}
                                disabled={!gridSelection?.rows || mappedRecords.length === 0}
                              >
                                Delete Selected
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                color="red"
                                onClick={() => setMappedRecords([])}
                                disabled={!mappedRecords || mappedRecords.length === 0}
                              >
                                Clear All
                              </Button>
                            </Group>
                          </Group>
                          <Box style={{ flexGrow: 1, height: 400 }}>
                            <DataEditor
                              columns={mappedRecords && mappedRecords.length > 0 ? columns : []}
                              rows={mappedRecords && mappedRecords.length > 0 ? mappedRecords.length : 1}
                              getCellContent={
                                mappedRecords && mappedRecords.length > 0
                                  ? getCellContent
                                  : () => ({ kind: GridCellKind.Text, data: '', displayData: '', allowOverlay: false })
                              }
                              onCellEdited={mappedRecords && mappedRecords.length > 0 ? onCellEdited : undefined}
                              onDelete={mappedRecords && mappedRecords.length > 0 ? onDelete : undefined}
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
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Step 6: Generate Delete Functionality */}
                <Accordion.Item value="step6">
                  <Accordion.Control>
                    <Group gap="xs" align="center">
                      <Text size="lg" fw={600}>
                        6. Generate Delete Functionality
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
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '400px',
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
                            style={{ width: 'fit-content' }}
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
                            onChange={(value) => setSelectedDeleteId(value || '')}
                            data={
                              mappedRecords && mappedRecords.length > 0
                                ? mappedRecords.map((item: any, index: number) => {
                                    const idValue = item.__id || item.id || item.ID || item.Id || index.toString();
                                    return {
                                      value: String(idValue),
                                      label: `${idValue} - ${JSON.stringify(item).substring(0, 50)}...`,
                                    };
                                  })
                                : []
                            }
                            disabled={!mappedRecords || mappedRecords.length === 0}
                          />
                          <Button
                            onClick={handleDeleteRecord}
                            disabled={!selectedDeleteId}
                            leftSection={<Trash size={16} />}
                            color="red"
                            variant="outline"
                            style={{ width: 'fit-content' }}
                          >
                            Delete Record
                          </Button>
                          {!mappedRecords || mappedRecords.length === 0 ? (
                            <Text size="sm" c="dimmed">
                              No mapped data available. Preview records in step 5 first.
                            </Text>
                          ) : null}
                        </Stack>
                      </Group>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Step 7: Generate Create Functionality */}
                <Accordion.Item value="step7">
                  <Accordion.Control>
                    <Group gap="xs" align="center">
                      <Text size="lg" fw={600}>
                        7. Generate Create Functionality
                      </Text>
                      <Tooltip label="Generate a JavaScript function that can create new records in your API. This function will use fetch() to call the create endpoint with the record data.">
                        <Text size="sm" c="dimmed">
                          (What is create functionality?)
                        </Text>
                      </Tooltip>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Group align="flex-start" gap="md">
                        <Stack style={{ flex: 1 }} gap="sm">
                          <Textarea
                            label="Create Function"
                            placeholder="Enter or generate a JavaScript function for creating records (e.g., async function createRecord(recordData, apiKey) { ... })"
                            value={createFunction}
                            onChange={(e) => setCreateFunction(e.target.value)}
                            styles={{
                              input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '400px',
                              },
                            }}
                          />
                          <Button
                            leftSection={<Sparkle size={16} />}
                            onClick={async () => {
                              if (!aiPrompt.trim()) {
                                notifications.show({
                                  title: 'No prompt provided',
                                  message: 'Please enter a description of your data in step 1.',
                                  color: 'red',
                                });
                                return;
                              }

                              setLoading(true);
                              try {
                                const result = await generateCreateRecord(aiPrompt);
                                setCreateFunction(result);
                                notifications.show({
                                  title: 'Create function generated',
                                  message: 'The create function has been generated successfully.',
                                  color: 'green',
                                });
                              } catch (error) {
                                console.error('Error generating create function:', error);
                                notifications.show({
                                  title: 'Error generating create function',
                                  message: error instanceof Error ? error.message : 'An unknown error occurred',
                                  color: 'red',
                                });
                              } finally {
                                setLoading(false);
                              }
                            }}
                            loading={loading}
                            disabled={!aiPrompt.trim()}
                            size="sm"
                            variant="light"
                            style={{ width: 'fit-content' }}
                          >
                            Generate Create Function
                          </Button>
                        </Stack>
                        <Stack style={{ flex: 1 }} gap="sm">
                          <Text size="sm" fw={500}>
                            Test Create Function:
                          </Text>
                          <Textarea
                            label="Record Data (JSON)"
                            placeholder='{"name": "John Doe", "email": "john@example.com"}'
                            value={createRecordDataText}
                            onChange={(e) => {
                              setCreateRecordDataText(e.target.value);
                              try {
                                const data = JSON.parse(e.target.value);
                                setCreateRecordData(data);
                              } catch {
                                // Allow intermediate broken states - don't update the parsed data
                                // The user can continue typing invalid JSON temporarily
                              }
                            }}
                            styles={{
                              input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '200px',
                              },
                            }}
                          />
                          <Button
                            onClick={async () => {
                              if (!createFunction.trim()) {
                                notifications.show({
                                  title: 'No create function',
                                  message: 'Please generate or enter a create function first.',
                                  color: 'red',
                                });
                                return;
                              }

                              if (!selectedTableFromList) {
                                notifications.show({
                                  title: 'No table selected',
                                  message: 'Please select a table from the list in step 2 first.',
                                  color: 'red',
                                });
                                return;
                              }

                              setLoading(true);
                              try {
                                await executeCreateRecord(
                                  createFunction,
                                  createRecordData,
                                  apiKey,
                                  selectedTableFromList,
                                );
                                notifications.show({
                                  title: 'Create successful',
                                  message: 'Successfully created new record',
                                  color: 'green',
                                });
                              } catch (error) {
                                console.error('Error creating record:', error);
                                notifications.show({
                                  title: 'Create failed',
                                  message: error instanceof Error ? error.message : 'An unknown error occurred',
                                  color: 'red',
                                });
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={!createFunction.trim()}
                            leftSection={<Plus size={16} />}
                            color="green"
                            variant="outline"
                            style={{ width: 'fit-content' }}
                          >
                            Create Record
                          </Button>
                        </Stack>
                      </Group>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Step 8: Generate Update Functionality */}
                <Accordion.Item value="step8">
                  <Accordion.Control>
                    <Group gap="xs" align="center">
                      <Text size="lg" fw={600}>
                        8. Generate Update Functionality
                      </Text>
                      <Tooltip label="Generate a JavaScript function that can update existing records in your API. This function will use fetch() to call the update endpoint with the record ID and data.">
                        <Text size="sm" c="dimmed">
                          (What is update functionality?)
                        </Text>
                      </Tooltip>
                    </Group>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      <Group align="flex-start" gap="md">
                        <Stack style={{ flex: 1 }} gap="sm">
                          <Textarea
                            label="Update Function"
                            placeholder="Enter or generate a JavaScript function for updating records (e.g., async function updateRecord(recordId, recordData, apiKey) { ... })"
                            value={updateFunction}
                            onChange={(e) => setUpdateFunction(e.target.value)}
                            styles={{
                              input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '400px',
                              },
                            }}
                          />
                          <Button
                            leftSection={<Sparkle size={16} />}
                            onClick={async () => {
                              if (!aiPrompt.trim()) {
                                notifications.show({
                                  title: 'No prompt provided',
                                  message: 'Please enter a description of your data in step 1.',
                                  color: 'red',
                                });
                                return;
                              }

                              setLoading(true);
                              try {
                                const result = await generateUpdateRecord(aiPrompt);
                                setUpdateFunction(result);
                                notifications.show({
                                  title: 'Update function generated',
                                  message: 'The update function has been generated successfully.',
                                  color: 'green',
                                });
                              } catch (error) {
                                console.error('Error generating update function:', error);
                                notifications.show({
                                  title: 'Error generating update function',
                                  message: error instanceof Error ? error.message : 'An unknown error occurred',
                                  color: 'red',
                                });
                              } finally {
                                setLoading(false);
                              }
                            }}
                            loading={loading}
                            disabled={!aiPrompt.trim()}
                            size="sm"
                            variant="light"
                            style={{ width: 'fit-content' }}
                          >
                            Generate Update Function
                          </Button>
                        </Stack>
                        <Stack style={{ flex: 1 }} gap="sm">
                          <Text size="sm" fw={500}>
                            Test Update Function:
                          </Text>
                          <Select
                            label="Select ID to Update"
                            placeholder="Choose an ID from the mapped data above"
                            value={selectedUpdateId}
                            onChange={(value) => setSelectedUpdateId(value || '')}
                            data={
                              mappedRecords && mappedRecords.length > 0
                                ? mappedRecords.map((item: any, index: number) => {
                                    const idValue = item.__id || item.id || item.ID || item.Id || index.toString();
                                    return {
                                      value: String(idValue),
                                      label: `${idValue} - ${JSON.stringify(item).substring(0, 50)}...`,
                                    };
                                  })
                                : []
                            }
                            disabled={!mappedRecords || mappedRecords.length === 0}
                          />
                          <Textarea
                            label="Update Data (JSON)"
                            placeholder='{"name": "Updated Name", "email": "updated@example.com"}'
                            value={updateRecordDataText}
                            onChange={(e) => {
                              setUpdateRecordDataText(e.target.value);
                              try {
                                const data = JSON.parse(e.target.value);
                                setUpdateRecordData(data);
                              } catch {
                                // Allow intermediate broken states - don't update the parsed data
                                // The user can continue typing invalid JSON temporarily
                              }
                            }}
                            styles={{
                              input: {
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                height: '150px',
                              },
                            }}
                          />
                          <Button
                            onClick={async () => {
                              if (!updateFunction.trim()) {
                                notifications.show({
                                  title: 'No update function',
                                  message: 'Please generate or enter an update function first.',
                                  color: 'red',
                                });
                                return;
                              }

                              if (!selectedTableFromList) {
                                notifications.show({
                                  title: 'No table selected',
                                  message: 'Please select a table from the list in step 2 first.',
                                  color: 'red',
                                });
                                return;
                              }

                              setLoading(true);
                              try {
                                await executeUpdateRecord(
                                  updateFunction,
                                  selectedUpdateId,
                                  updateRecordData,
                                  apiKey,
                                  selectedTableFromList,
                                );
                                notifications.show({
                                  title: 'Update successful',
                                  message: 'Successfully updated record',
                                  color: 'green',
                                });
                              } catch (error) {
                                console.error('Error updating record:', error);
                                notifications.show({
                                  title: 'Update failed',
                                  message: error instanceof Error ? error.message : 'An unknown error occurred',
                                  color: 'red',
                                });
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={!updateFunction.trim() || !selectedUpdateId}
                            leftSection={<PencilSimple size={16} />}
                            color="blue"
                            variant="outline"
                            style={{ width: 'fit-content' }}
                          >
                            Update Record
                          </Button>
                          {!mappedRecords || mappedRecords.length === 0 ? (
                            <Text size="sm" c="dimmed">
                              No mapped data available. Preview records in step 5 first.
                            </Text>
                          ) : null}
                        </Stack>
                      </Group>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>

                {/* Step 9: Configure Field Mapping (Deprecated) */}
                <Accordion.Item value="step9">
                  <Accordion.Control>
                    <Group gap="xs" align="center">
                      <Text size="lg" fw={600}>
                        9. Configure Field Mapping (Deprecated)
                      </Text>
                      <Tooltip label="This step is deprecated. Field mapping is now handled automatically by the schema. This section is kept for reference only.">
                        <Text size="sm" c="dimmed">
                          (Deprecated - kept for reference)
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
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                  },
                                }}
                              />
                              <Button
                                variant="light"
                                size="xs"
                                onClick={() => {
                                  if (!response) {
                                    notifications.show({
                                      title: 'No data available',
                                      message:
                                        "Please fetch data first to see available paths. Click 'Fetch Data' in step 2.",
                                      color: 'red',
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
                                    fontFamily: 'monospace',
                                    fontSize: '12px',
                                  },
                                }}
                              />
                              <Button
                                variant="light"
                                size="xs"
                                onClick={() => {
                                  if (!response) {
                                    notifications.show({
                                      title: 'No data available',
                                      message:
                                        "Please fetch data first to see available paths. Click 'Fetch Data' in step 2.",
                                      color: 'red',
                                    });
                                    return;
                                  }
                                  const arrayData =
                                    recordArrayPath === '.' ? response : _.get(response, recordArrayPath);
                                  if (!Array.isArray(arrayData)) {
                                    notifications.show({
                                      title: 'Invalid array path',
                                      message: 'The selected record array path does not point to an array.',
                                      color: 'red',
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
                                        title: 'No data available',
                                        message:
                                          "Please fetch data first to see available paths. Click 'Fetch Data' in step 2.",
                                        color: 'red',
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
                                  onChange={(e) => handleMappingChange(mapping.id, 'source', e.target.value)}
                                  style={{ flex: 1 }}
                                />
                                <Text size="sm">→</Text>
                                <TextInput
                                  placeholder="Destination field name"
                                  value={mapping.destination}
                                  onChange={(e) => handleMappingChange(mapping.id, 'destination', e.target.value)}
                                  style={{ flex: 1 }}
                                />
                                <Select
                                  placeholder="Type"
                                  value={mapping.pgType}
                                  onChange={(value) => handleMappingChange(mapping.id, 'pgType', value || 'text')}
                                  data={[
                                    { value: 'text', label: 'Text' },
                                    { value: 'text[]', label: 'Text Array' },
                                    { value: 'numeric', label: 'Numeric' },
                                    { value: 'numeric[]', label: 'Numeric Array' },
                                    { value: 'boolean', label: 'Boolean' },
                                    { value: 'boolean[]', label: 'Boolean Array' },
                                    { value: 'jsonb', label: 'JSONB' },
                                  ]}
                                  style={{ width: '120px' }}
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
                              style={{ width: 'fit-content' }}
                            >
                              Add Field Mapping
                            </Button>
                          </Stack>
                        </Stack>
                      </Group>
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            )}
          </Stack>
        </Container>
      </Box>

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
                  if (currentMappingId) {
                    handleMappingChange(currentMappingId, 'source', path);
                    // Auto-populate destination field by replacing dots with underscores
                    const destinationField = path.replace(/\./g, '_');
                    handleMappingChange(currentMappingId, 'destination', destinationField);
                  }
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

      {/* ID Path Selection Modal */}
      <Modal opened={idPathModalOpened} onClose={() => setIdPathModalOpened(false)} title="Select ID Path" size="lg">
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            Click on a path to use it as the ID field:
          </Text>
          <Stack gap="xs" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {availablePaths.map((path) => (
              <Button
                key={path}
                variant="subtle"
                justify="flex-start"
                onClick={() => {
                  setIdPath(path);
                  setIdPathModalOpened(false);
                }}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
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
        title="Create New Connector"
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
            <Button variant="light" onClick={() => setTableNameModalOpened(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newTableName.trim()) {
                  notifications.show({
                    title: 'Table name required',
                    message: 'Please enter a table name',
                    color: 'red',
                  });
                  return;
                }
                setLoading(true);
                try {
                  const createConnectorDto: CreateCustomConnectorDto = {
                    name: newTableName.trim(),
                  };
                  const createdConnector = await createCustomConnector(createConnectorDto);
                  setTableNameModalOpened(false);
                  setNewTableName('');
                  setSelectedConnectorId(createdConnector.id);
                } catch (err: any) {
                  notifications.show({
                    title: 'Error creating table',
                    message: err.message,
                    color: 'red',
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
    </Box>
  );
};
