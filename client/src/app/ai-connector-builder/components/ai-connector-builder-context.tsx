/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCustomConnector, useCustomConnectors } from '@/hooks/use-custom-connector';
import { executeDeleteRecord, executeListTables, generateDeleteRecord, generateListTables } from '@/lib/api/api-import';
import { CreateCustomConnectorDto, CustomConnector } from '@/types/server-entities/custom-connector';
import { EditableGridCell, GridCell, GridCellKind, GridColumn, GridSelection, Item } from '@glideapps/glide-data-grid';
import { notifications } from '@mantine/notifications';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { MappingRow } from './types';
import { useConnectorAccordeon } from './useConnectorAccordeon';

const AiConnectorBuilderContext = createContext<AiConnectorBuilderContextType | undefined>(undefined);

interface AiConnectorBuilderProviderProps {
  children: ReactNode;
}

export const AiConnectorBuilderProvider = ({ children }: AiConnectorBuilderProviderProps) => {
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

  const connectorAccordeon = useConnectorAccordeon();

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
  // const [pathModalOpened, setPathModalOpened] = useState(false);
  // const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [mappedRecords, setMappedRecords] = useState<any[] | null>(null);

  // State for record array path selection
  // const [recordArrayPath, setRecordArrayPath] = useState<string>('');
  // const [recordArrayPathModalOpened, setRecordArrayPathModalOpened] = useState(false);
  // const [availableArrayPaths, setAvailableArrayPaths] = useState<string[]>([]);

  // State for ID path selection
  // const [idPath, setIdPath] = useState<string>('');
  // const [idPathModalOpened, setIdPathModalOpened] = useState(false);

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

  // // Function to extract all possible paths from an array of objects (combining all fields)
  // const extractAllPathsFromArray = useCallback(
  //   (array: any[]): string[] => {
  //     const allPaths = new Set<string>();

  //     array.forEach((item) => {
  //       if (typeof item === 'object' && item !== null) {
  //         const paths = extractPaths(item);
  //         paths.forEach((path) => allPaths.add(path));
  //       }
  //     });

  //     return Array.from(allPaths);
  //   },
  //   [extractPaths],
  // );

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

      // // Create the mapping configuration from the current mappings (optional)
      // const fields = mappings
      //   .filter((m) => m.destination && m.source)
      //   .map((m) => ({
      //     path: m.source,
      //     type: m.pgType,
      //     name: m.destination,
      //   }));

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

  // const openPathModal = (mappingId: string): void => {
  //   setCurrentMappingId(mappingId);
  //   // setPathModalOpened(true);
  // };

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

  const value: AiConnectorBuilderContextType = {
    loading,
    tableNameModalOpened,
    newTableName,
    connectorAccordeon,
    customConnectors,
    selectedConnectorId,
    selectedConnector,
    connectorName,
    createCustomConnector,
    updateCustomConnector,
    deleteCustomConnector,
    connectorsLoading,
    setTableNameModalOpened,
    setNewTableName,
    setSelectedConnectorId,
    setConnectorName,
    setApiKey,
    setAiPrompt,
    // setIdPath,
    setMappings,
    setCurrentMappingId,
    setDeleteFunction,
    setSelectedDeleteId,
    setCreateFunction,
    setCreateRecordData,
    setUpdateFunction,
    setSelectedUpdateId,
    setUpdateRecordData,

    // extractPaths,
    // extractAllPathsFromArray,
    onDelete,
    // openPathModal,
    handleMappingChange,
    addMappingRow,
    removeMappingRow,
    handleGenerateSchema,
    handleTestSchema,
    handleAiGenerate,
    handleGenerateDeleteFunction,
    handleDeleteRecord,
    handleGenerateListTables,
    handleTestListTables,
    handleTestPollRecords,
    handleApplyMapping,
    save,
    aiPrompt,
    apiKey,
    listTablesFunction,
    tables,
    selectedTableFromList,
    fetchSchemaFunction,
    // idPath,
    // idPathModalOpened,
    mappings,
    currentMappingId,
    gridSelection,
    setGridSelection,
    // pathModalOpened,
    // availablePaths,

    // setIdPathModalOpened,
    createRecordDataText,
    selectedUpdateId,
    updateRecordDataText,
    deleteFunction,
    selectedDeleteId,
    createFunction,
    createRecordData,
    updateFunction,
    updateRecordData,
    getCellContent,
    onCellEdited,
    setSelectedTableFromList,
    setLoading,
    setListTablesFunction,
    setFetchSchemaFunction,
    schema,
    pollRecordsFunction,
    setPollRecordsFunction,
    response,
    mappedRecords,
    setMappedRecords,
    columns,
    setResponse,
    setColumns,
    setCreateRecordDataText,
    setUpdateRecordDataText,
    // setAvailablePaths,
    // setPathModalOpened,
    // extractArrayPaths,
  };

  return <AiConnectorBuilderContext.Provider value={value}>{children}</AiConnectorBuilderContext.Provider>;
};

type AiConnectorBuilderContextType = {
  loading: boolean;
  setLoading: (value: boolean) => void;
  tableNameModalOpened: boolean;
  newTableName: string;
  connectorAccordeon: ReturnType<typeof useConnectorAccordeon>;
  customConnectors: CustomConnector[] | undefined;
  selectedConnectorId: string | null;
  selectedConnector: CustomConnector | null | undefined;
  connectorName: string;
  createCustomConnector: (dto: CreateCustomConnectorDto) => Promise<CustomConnector>;
  updateCustomConnector: (connectorId: string, dto: CreateCustomConnectorDto) => Promise<CustomConnector>;
  deleteCustomConnector: (id: string) => Promise<void>;
  connectorsLoading: boolean;
  setTableNameModalOpened: (value: boolean) => void;
  setNewTableName: (value: string) => void;
  setSelectedConnectorId: (value: string | null) => void;
  setConnectorName: (value: string) => void;
  setApiKey: (value: string) => void;
  setAiPrompt: (value: string) => void;
  // setRecordArrayPath: (value: string) => void;
  // setRecordArrayPathModalOpened: (value: boolean) => void;
  // setIdPath: (value: string) => void;
  setMappings: (value: MappingRow[]) => void;
  setCurrentMappingId: (value: string | null) => void;
  setDeleteFunction: (value: string) => void;
  setSelectedDeleteId: (value: string) => void;
  setCreateFunction: (value: string) => void;
  setCreateRecordData: (value: Record<string, unknown>) => void;
  setUpdateFunction: (value: string) => void;
  setSelectedUpdateId: (value: string) => void;
  setUpdateRecordData: (value: Record<string, unknown>) => void;
  // extractPaths: (obj: any, prefix?: string) => string[];
  // extractAllPathsFromArray: (array: any[]) => string[];
  onDelete: (selection: GridSelection) => boolean;
  // openPathModal: (mappingId: string) => void;
  handleMappingChange: (id: string, field: 'destination' | 'source' | 'pgType', value: string) => void;
  addMappingRow: () => void;
  removeMappingRow: (id: string) => void;
  handleGenerateSchema: () => Promise<void>;
  handleTestSchema: () => Promise<void>;
  handleAiGenerate: () => Promise<void>;
  handleGenerateDeleteFunction: () => Promise<void>;
  handleDeleteRecord: () => Promise<void>;
  handleGenerateListTables: () => Promise<void>;
  handleTestListTables: () => Promise<void>;
  handleTestPollRecords: () => Promise<void>;
  handleApplyMapping: () => Promise<void>;
  save: () => Promise<void>;
  aiPrompt: string;
  apiKey: string;
  listTablesFunction: string;
  tables: any[] | null;
  selectedTableFromList: string[] | null;
  fetchSchemaFunction: string;
  // idPath: string;
  // idPathModalOpened: boolean;
  mappings: MappingRow[];
  currentMappingId: string | null;
  gridSelection: GridSelection | undefined;
  setGridSelection: (value: GridSelection | undefined) => void;
  // pathModalOpened: boolean;

  // setAvailableArrayPaths: (value: string[]) => void;
  // setIdPathModalOpened: (value: boolean) => void;
  createRecordDataText: string;
  selectedUpdateId: string;
  updateRecordDataText: string;
  deleteFunction: string;
  selectedDeleteId: string;
  createFunction: string;
  createRecordData: Record<string, unknown>;
  updateFunction: string;
  updateRecordData: Record<string, unknown>;
  getCellContent: (cell: Item) => GridCell;
  onCellEdited: (cell: Item, newValue: EditableGridCell) => void;
  setSelectedTableFromList: (value: string[] | null) => void;
  setListTablesFunction: (value: string) => void;
  setFetchSchemaFunction: (value: string) => void;
  schema: any[] | null;
  pollRecordsFunction: string;
  setPollRecordsFunction: (value: string) => void;
  response: any[] | null;
  mappedRecords: any[] | null;
  setMappedRecords: (value: any[] | null) => void;
  columns: GridColumn[];
  setResponse: (value: any[] | null) => void;
  setColumns: (value: GridColumn[]) => void;
  setCreateRecordDataText: (value: string) => void;
  setUpdateRecordDataText: (value: string) => void;
  // setAvailablePaths: (value: string[]) => void;
  // setPathModalOpened: (value: boolean) => void;
  // extractArrayPaths: (obj: any, prefix?: string) => string[];
};

export const useAiConnectorBuilderContext = (): AiConnectorBuilderContextType => {
  const context = useContext(AiConnectorBuilderContext);
  if (context === undefined) {
    throw new Error('useAiConnectorBuilder must be used within an AiConnectorBuilderProvider');
  }
  return context;
};
