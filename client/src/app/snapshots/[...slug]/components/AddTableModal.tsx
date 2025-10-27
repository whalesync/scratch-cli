'use client';

import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { TextRegularSm, TextTitle3 } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useConnectorAccounts } from '@/hooks/use-connector-account';
import { connectorAccountsApi } from '@/lib/api/connector-accounts';
import { snapshotApi } from '@/lib/api/snapshot';
import { serviceName } from '@/service-naming-conventions';
import { Service } from '@/types/server-entities/connector-accounts';
import { AddTableToSnapshotDto } from '@/types/server-entities/snapshot';
import { EntityId, TableList, TablePreview } from '@/types/server-entities/table-list';
import { Center, Checkbox, Group, Loader, Modal, ScrollArea, Stack, Table, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

interface ConnectorOption {
  connectorAccountId: string | null;
  service: Service;
  displayName: string;
  isVirtual: boolean;
}

interface AddTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  snapshotId: string;
  onTableAdded: () => void;
}

export const AddTableModal = ({ isOpen, onClose, snapshotId, onTableAdded }: AddTableModalProps) => {
  const [step, setStep] = useState<'select-connector' | 'select-table'>('select-connector');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedConnectorAccountId, setSelectedConnectorAccountId] = useState<string | null>(null);
  const [selectedTableIds, setSelectedTableIds] = useState<EntityId[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [tables, setTables] = useState<TableList | null>(null);
  const [loadingTables, setLoadingTables] = useState(false);

  const { connectorAccounts, isLoading: loadingAccounts } = useConnectorAccounts();

  // Add CSV as a virtual connector (no connectorAccountId)
  const allConnectorOptions: ConnectorOption[] = [
    {
      connectorAccountId: null,
      service: Service.CSV,
      displayName: 'CSV uploads',
      isVirtual: true,
    },
    ...(connectorAccounts || []).map((ca) => ({
      connectorAccountId: ca.id,
      service: ca.service,
      displayName: ca.displayName,
      isVirtual: false,
    })),
  ];

  // Fetch tables when connector is selected
  useEffect(() => {
    const fetchTables = async () => {
      if (!selectedService) {
        setTables(null);
        return;
      }

      setLoadingTables(true);
      try {
        const tableList = await connectorAccountsApi.listTables(selectedService, selectedConnectorAccountId);
        setTables(tableList);
      } catch (error) {
        console.error('Failed to fetch tables:', error);
        setTables({ tables: [] });
      } finally {
        setLoadingTables(false);
      }
    };

    if (step === 'select-table' && selectedService) {
      fetchTables();
    }
  }, [step, selectedService, selectedConnectorAccountId]);

  const handleConnectorSelect = (connectorAccountId: string | null, service: Service) => {
    setSelectedConnectorAccountId(connectorAccountId);
    setSelectedService(service);
    setStep('select-table');
  };

  const handleTableToggle = (tableId: EntityId) => {
    setSelectedTableIds((prev) => {
      const isSelected = prev.some((id) => JSON.stringify(id) === JSON.stringify(tableId));
      if (isSelected) {
        return prev.filter((id) => JSON.stringify(id) !== JSON.stringify(tableId));
      } else {
        return [...prev, tableId];
      }
    });
  };

  const handleAddTables = async () => {
    if (selectedTableIds.length === 0 || !selectedService) return;

    setIsAdding(true);
    try {
      // Add all selected tables
      for (const tableId of selectedTableIds) {
        const dto: AddTableToSnapshotDto = {
          service: selectedService,
          connectorAccountId: selectedConnectorAccountId || undefined,
          tableId: tableId,
        };
        await snapshotApi.addTable(snapshotId, dto);
      }

      ScratchpadNotifications.success({
        title: `${selectedTableIds.length} table${selectedTableIds.length > 1 ? 's' : ''} added`,
        message: 'The tables have been added to your snapshot.',
      });

      onTableAdded();
      handleClose();
    } catch (error) {
      console.error('Failed to add tables:', error);
      ScratchpadNotifications.error({
        title: 'Failed to add tables',
        message: error instanceof Error ? error.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleClose = () => {
    setStep('select-connector');
    setSelectedService(null);
    setSelectedConnectorAccountId(null);
    setSelectedTableIds([]);
    onClose();
  };

  const handleBack = () => {
    setStep('select-connector');
    setSelectedTableIds([]);
  };

  return (
    <Modal opened={isOpen} onClose={handleClose} title="Add Table to Snapshot" size="lg" centered>
      <Stack gap="md">
        {step === 'select-connector' && (
          <>
            <TextRegularSm c="dimmed">
              Select a data source to add a table from. You can add tables from different sources to the same snapshot.
            </TextRegularSm>

            {loadingAccounts ? (
              <Center py="xl">
                <Loader size="sm" />
              </Center>
            ) : (
              <ScrollArea.Autosize mah={400} mih={400}>
                <Table highlightOnHover withTableBorder>
                  <Table.Tbody>
                    {allConnectorOptions.map((connector) => (
                      <Table.Tr
                        key={connector.connectorAccountId || 'csv'}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleConnectorSelect(connector.connectorAccountId, connector.service)}
                      >
                        <Table.Td>
                          <Group gap="md" wrap="nowrap">
                            <ConnectorIcon connector={connector.service} size={32} />
                            <div style={{ flex: 1 }}>
                              <Text size="sm" fw={500}>
                                {connector.displayName}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {serviceName(connector.service)}
                              </Text>
                            </div>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            )}
          </>
        )}

        {step === 'select-table' && (
          <>
            <Group justify="space-between" align="center">
              <TextTitle3>Select a Table</TextTitle3>
              <ButtonSecondaryOutline size="xs" onClick={handleBack}>
                Back to Connectors
              </ButtonSecondaryOutline>
            </Group>

            <TextRegularSm c="dimmed">
              Choose a table to add to your snapshot. The table&apos;s data will be downloaded and added to your
              snapshot.
            </TextRegularSm>

            {loadingTables ? (
              <Center py="xl">
                <Loader size="sm" />
              </Center>
            ) : tables && tables.tables && tables.tables.length > 0 ? (
              <ScrollArea.Autosize mah={400} mih={400}>
                <Table highlightOnHover withTableBorder>
                  <Table.Tbody>
                    {tables.tables.map((table: TablePreview) => {
                      const isSelected = selectedTableIds.some((id) => JSON.stringify(id) === JSON.stringify(table.id));
                      return (
                        <Table.Tr
                          key={table.id.wsId}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleTableToggle(table.id)}
                        >
                          <Table.Td style={{ width: 40 }}>
                            <Checkbox
                              checked={isSelected}
                              onChange={() => handleTableToggle(table.id)}
                              onClick={() => handleTableToggle(table.id)}
                            />
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {table.displayName}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            ) : (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No tables available from this connector.
              </Text>
            )}

            <Group justify="flex-end" mt="md">
              <ButtonSecondaryOutline onClick={handleClose}>Cancel</ButtonSecondaryOutline>
              <ButtonPrimaryLight onClick={handleAddTables} disabled={selectedTableIds.length === 0} loading={isAdding}>
                Add {selectedTableIds.length > 0 ? selectedTableIds.length : ''} Table
                {selectedTableIds.length !== 1 ? 's' : ''}
              </ButtonPrimaryLight>
            </Group>
          </>
        )}

        {step === 'select-connector' && (
          <Group justify="flex-end" mt="md">
            <ButtonSecondaryOutline onClick={handleClose}>Cancel</ButtonSecondaryOutline>
          </Group>
        )}
      </Stack>
    </Modal>
  );
};
