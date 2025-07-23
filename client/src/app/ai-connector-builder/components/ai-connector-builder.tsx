/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  executeCreateRecord,
  executeUpdateRecord,
  generateCreateRecord,
  generateUpdateRecord,
} from '@/lib/api/api-import';
import { CreateCustomConnectorDto } from '@/types/server-entities/custom-connector';
import { DataEditor, GridCellKind } from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import {
  Accordion,
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
import { ArrowRight, CaretDown, CaretUp, PencilSimple, Plus, Sparkle, Trash } from '@phosphor-icons/react';
import { FC } from 'react';
import { useAiConnectorBuilderContext } from './ai-connector-builder-context';

export const ApiImport: FC = () => {
  const {
    loading,
    tableNameModalOpened,
    newTableName,
    customConnectors,
    selectedConnectorId,
    selectedConnector,
    setTableNameModalOpened,
    setNewTableName,
    setSelectedConnectorId,
    deleteCustomConnector,
    save,
    connectorAccordeon,
    aiPrompt,
    setAiPrompt,
    apiKey,
    setApiKey,
    listTablesFunction,
    tables,
    selectedTableFromList,
    setSelectedTableFromList,
    fetchSchemaFunction,
    handleGenerateListTables,
    handleTestListTables,
    handleGenerateSchema,
    handleTestSchema,
    handleAiGenerate,
    handleGenerateDeleteFunction,
    handleDeleteRecord,
    handleTestPollRecords,
    handleApplyMapping,
    setLoading,
    addMappingRow,
    connectorsLoading,
    setListTablesFunction,
    setFetchSchemaFunction,
    schema,
    pollRecordsFunction,
    setPollRecordsFunction,
    response,
    mappedRecords,
    onDelete,
    gridSelection,

    getCellContent,
    onCellEdited,
    setMappedRecords,
    setGridSelection,
    setDeleteFunction,
    setSelectedDeleteId,
    setCreateFunction,
    setCreateRecordData,
    setUpdateFunction,
    deleteFunction,
    selectedDeleteId,
    createFunction,
    createRecordData,
    updateFunction,
    selectedUpdateId,
    updateRecordData,
    createRecordDataText,
    updateRecordDataText,
    columns,
    connectorName,
    createCustomConnector,
    currentMappingId,
    handleMappingChange,
    mappings,
    removeMappingRow,
    setColumns,
    setConnectorName,
    setCurrentMappingId,
    setMappings,
    setResponse,
    setSelectedUpdateId,
    setUpdateRecordData,
    updateCustomConnector,
    setCreateRecordDataText,
    setUpdateRecordDataText,
  } = useAiConnectorBuilderContext();

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
                  <Button
                    variant="light"
                    size="xs"
                    onClick={connectorAccordeon.expandAll}
                    leftSection={<CaretDown size={16} />}
                  >
                    Expand All
                  </Button>
                  <Button
                    variant="light"
                    size="xs"
                    onClick={connectorAccordeon.collapseAll}
                    leftSection={<CaretUp size={16} />}
                  >
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
              <Accordion
                value={connectorAccordeon.accordionValue}
                onChange={connectorAccordeon.setAccordionValue}
                variant="contained"
                multiple
              >
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
              </Accordion>
            )}
          </Stack>
        </Container>
      </Box>

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
