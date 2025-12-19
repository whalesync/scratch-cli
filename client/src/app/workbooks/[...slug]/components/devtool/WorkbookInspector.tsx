import { CopyText } from '@/app/components/CopyText';
import { LabelValuePair } from '@/app/components/LabelValuePair';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { Badge, BadgeOK } from '@/app/components/base/badge';
import { Text12Regular, Text13Regular, TextTitle3 } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useDevTools } from '@/hooks/use-dev-tools';
import { ColumnSpec, SnapshotColumnSettings, SnapshotColumnSettingsMap, SnapshotTable, TableSpec } from '@spinner/shared-types';
import { formatDate } from '@/utils/helpers';
import { Center, Code, Divider, Group, Modal, ModalProps, Stack, Table, Tabs, Text } from '@mantine/core';

export const WorkbookInspector = (props: ModalProps) => {
  const { isDevToolsEnabled } = useDevTools();
  const { workbook, isLoading } = useActiveWorkbook();

  if (!isDevToolsEnabled) {
    return (
      <Center h="100%">
        <Text c="dimmed">Dev tools are not enabled</Text>
      </Center>
    );
  }

  if (isLoading) {
    return <LoaderWithMessage message="Loading workbook..." centered />;
  }

  if (!workbook) {
    return (
      <Center h="100%">
        <Text c="dimmed">No workbook found</Text>
      </Center>
    );
  }

  const snapshotTables = workbook.snapshotTables || [];
  const defaultTab = snapshotTables.length > 0 ? snapshotTables[0].id : null;

  return (
    <Modal {...props} centered fullScreen title="Workbook Inspector">
      <Stack gap="md">
        <Stack gap="sm">
          <Stack gap="xs">
            <LabelValuePair label="Workbook ID" value={workbook.id} canCopy />
            <LabelValuePair label="Name" value={workbook.name || 'N/A'} />
            <LabelValuePair label="Created At" value={formatDate(workbook.createdAt)} />
            <LabelValuePair label="Updated At" value={formatDate(workbook.updatedAt)} />
          </Stack>
        </Stack>
        <Divider />
        <TextTitle3>Tables</TextTitle3>
        {/* Tables Section */}
        {snapshotTables.length > 0 ? (
          <Tabs defaultValue={defaultTab || undefined}>
            <Tabs.List>
              {snapshotTables.map((table) => (
                <Tabs.Tab key={table.id} value={table.id}>
                  {table.tableSpec.name}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {snapshotTables.map((table) => (
              <Tabs.Panel key={table.id} value={table.id} p="md">
                <TableDetails table={table} />
              </Tabs.Panel>
            ))}
          </Tabs>
        ) : (
          <Center>
            <Text c="dimmed">No tables in this snapshot</Text>
          </Center>
        )}
      </Stack>
    </Modal>
  );
};

const TableDetails = ({ table }: { table: SnapshotTable }) => {
  const tableSpec = table.tableSpec as TableSpec;
  const columnSettings = table.columnSettings as SnapshotColumnSettingsMap;
  return (
    <Stack gap="md">
      <Group gap="lg">
        <Stack gap="xs">
          <LabelValuePair label="Snapshot Table ID" value={table.id} canCopy />
          <LabelValuePair label="Name" value={tableSpec.name} />
          <LabelValuePair label="Scratch Id" value={tableSpec.id.wsId} canCopy />
          <LabelValuePair label="Remote ID" value={JSON.stringify(tableSpec.id.remoteId, null, 0)} canCopy />
          <LabelValuePair
            label="Connector"
            value={
              <Text13Regular>
                {table.connectorService}
                {table.connectorDisplayName && ` - ${table.connectorDisplayName}`}
              </Text13Regular>
            }
          />
        </Stack>
        <Stack gap="xs">
          <LabelValuePair label="Hidden" value={String(table.hidden)} />
          <LabelValuePair label="Dirty" value={String(table.dirty)} />
          <LabelValuePair
            label="Hidden Columns"
            value={table.hiddenColumns.length > 0 ? `[${table.hiddenColumns.join(', ')}]` : '[]'}
          />

          <LabelValuePair label="Lock" value={String(table.lock)} />
          <LabelValuePair label="Page Size" value={String(table.pageSize)} />
          <LabelValuePair label="Active SQL Filter" value={<code>{table.activeRecordSqlFilter ?? ''}</code>} />

          <LabelValuePair
            label="Title Column Remote ID"
            value={tableSpec.titleColumnRemoteId ? tableSpec.titleColumnRemoteId.join(', ') : 'N/A'}
          />
        </Stack>
      </Group>

      <Stack gap="xs">
        <TextTitle3>Columns ({tableSpec.columns.length})</TextTitle3>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Td>Name</Table.Td>
              <Table.Td>Scratch ID</Table.Td>
              <Table.Td>Remote ID</Table.Td>
              <Table.Td>DB Type</Table.Td>
              <Table.Td>Hidden</Table.Td>
              <Table.Td>Tags</Table.Td>
              <Table.Td maw="30%">Metadata</Table.Td>
              <Table.Td maw="100px">Data Converter</Table.Td>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tableSpec.columns
              .slice()
              .sort((a, b) => {
                const aHidden = table.hiddenColumns.includes(a.id.wsId);
                const bHidden = table.hiddenColumns.includes(b.id.wsId);
                // Sort hidden columns to the end
                if (aHidden && !bHidden) return 1;
                if (!aHidden && bHidden) return -1;
                return 0;
              })
              .map((column, index) => (
                <ColumnSpecDetails
                  key={column.id.wsId || index}
                  column={column}
                  settings={columnSettings[column.id.wsId]}
                  isHidden={table.hiddenColumns.includes(column.id.wsId)}
                  titleColumnRemoteId={tableSpec.titleColumnRemoteId}
                />
              ))}
          </Table.Tbody>
        </Table>
      </Stack>
    </Stack>
  );
};

const ColumnSpecDetails = ({
  column,
  settings,
  isHidden,
  titleColumnRemoteId,
}: {
  column: ColumnSpec;
  settings?: SnapshotColumnSettings;
  isHidden: boolean;
  titleColumnRemoteId?: string[];
}) => {
  const isTitleColumn =
    titleColumnRemoteId &&
    column.id.remoteId.length === titleColumnRemoteId.length &&
    column.id.remoteId.every((val, idx) => val === titleColumnRemoteId[idx]);
  const tags: string[] = [];
  if (column.readonly) {
    tags.push('Readonly');
  }
  if (column.required) {
    tags.push('Required');
  }
  if (column.metadata && column.metadata.scratch) {
    tags.push('Scratch');
  }

  return (
    <Table.Tr bg={isHidden ? 'var(--mantine-color-gray-1)' : undefined}>
      <Table.Td>
        {column.name}
        {isTitleColumn && (
          <Text component="span" c="green" ml={4}>
            ★
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <CopyText value={column.id.wsId} />
      </Table.Td>
      <Table.Td>{column.id.remoteId}</Table.Td>

      <Table.Td>{column.pgType}</Table.Td>
      <Table.Td>
        <Text c={isHidden ? 'orange' : 'dimmed'}>{isHidden ? 'Yes' : 'No'}</Text>
      </Table.Td>
      <Table.Td>
        <Group gap="xs">{tags.length > 0 && tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</Group>
      </Table.Td>
      <Table.Td>{column.metadata && <pre>{JSON.stringify(column.metadata, null, 2)}</pre>}</Table.Td>
      <Table.Td>
        <Stack gap="xs">
          {settings?.dataConverter && <BadgeOK>{settings.dataConverter}</BadgeOK>}
          {column.dataConverterTypes && column.dataConverterTypes.length > 0 && (
            <>
              <Text12Regular>Options:</Text12Regular>
              <Code>{JSON.stringify(column.dataConverterTypes, null, 2)}</Code>
            </>
          )}
        </Stack>
      </Table.Td>
    </Table.Tr>
  );
};
