import { LabelValuePair } from '@/app/components/LabelValuePair';
import { LoaderWithMessage } from '@/app/components/LoaderWithMessage';
import { Text13Regular, TextTitle3 } from '@/app/components/base/text';
import { useActiveWorkbook } from '@/hooks/use-active-workbook';
import { useDevTools } from '@/hooks/use-dev-tools';
import { useWorkbookEditorUIStore } from '@/stores/workbook-editor-store';
import { formatDate } from '@/utils/helpers';
import { Center, Code, Divider, Group, Modal, ModalProps, Stack, Tabs, Text } from '@mantine/core';
import { DataFolder } from '@spinner/shared-types';
import { FolderIcon } from 'lucide-react';

export const WorkbookInspector = (props: ModalProps) => {
  const { isDevToolsEnabled } = useDevTools();
  const { workbook, isLoading } = useActiveWorkbook();
  const currentWorkbookMode = useWorkbookEditorUIStore((state) => state.workbookMode);

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

  const dataFolders = workbook.dataFolders || [];
  const defaultFolderTab = dataFolders.length > 0 ? dataFolders[0].id : null;

  return (
    <Modal {...props} centered fullScreen title="Workbook Inspector">
      <Stack gap="md">
        <Stack gap="sm">
          <Stack gap="xs">
            <LabelValuePair label="Workbook ID" value={workbook.id} canCopy />
            <LabelValuePair label="Name" value={workbook.name || 'N/A'} />
            <LabelValuePair label="Current Mode" value={currentWorkbookMode} />
            <LabelValuePair label="Created At" value={formatDate(workbook.createdAt)} />
            <LabelValuePair label="Updated At" value={formatDate(workbook.updatedAt)} />
          </Stack>
        </Stack>
        <Divider />
        <TextTitle3>Tables</TextTitle3>
        {/* Tables Section */}
        <TextTitle3>Data Folders</TextTitle3>
        {dataFolders.length > 0 ? (
          <Tabs defaultValue={defaultFolderTab || undefined} orientation="vertical">
            <Tabs.List>
              {dataFolders.map((folder) => (
                <Tabs.Tab
                  key={folder.id}
                  value={folder.id}
                  leftSection={<FolderIcon size={14} />}
                  styles={{ tabLabel: { textAlign: 'left' } }}
                >
                  {folder.name}
                </Tabs.Tab>
              ))}
            </Tabs.List>

            {dataFolders.map((folder) => (
              <Tabs.Panel key={folder.id} value={folder.id} p="md">
                <DataFolderDetails folder={folder} />
              </Tabs.Panel>
            ))}
          </Tabs>
        ) : (
          <Center>
            <Text c="dimmed">No data folders in this workbook</Text>
          </Center>
        )}
      </Stack>
    </Modal>
  );
};

const DataFolderDetails = ({ folder }: { folder: DataFolder }) => {
  return (
    <Stack gap="md">
      <Group gap="lg" align="flex-start">
        <Stack gap="xs">
          <LabelValuePair label="Data Folder ID" value={folder.id} canCopy />
          <LabelValuePair label="Name" value={folder.name} />
          <LabelValuePair label="Path" value={folder.path || 'N/A'} />
          <LabelValuePair label="Table ID" value={<Code>{folder.tableId?.join(', ') || 'N/A'}</Code>} />
          <LabelValuePair label="Parent ID" value={folder.parentId || 'N/A'} canCopy={!!folder.parentId} />
          <LabelValuePair
            label="Connector"
            value={
              <Text13Regular>
                {folder.connectorService || 'N/A'}
                {folder.connectorDisplayName && ` - ${folder.connectorDisplayName}`}
              </Text13Regular>
            }
          />
          <LabelValuePair
            label="Connector Account ID"
            value={folder.connectorAccountId || 'N/A'}
            canCopy={!!folder.connectorAccountId}
          />
        </Stack>
        <Stack gap="xs">
          <LabelValuePair label="Version" value={String(folder.version)} />
          <LabelValuePair label="Lock" value={folder.lock || 'None'} />
          <LabelValuePair
            label="Last Sync Time"
            value={folder.lastSyncTime ? formatDate(folder.lastSyncTime) : 'Never'}
          />
          <LabelValuePair
            label="Last Schema Refresh"
            value={folder.lastSchemaRefreshAt ? formatDate(folder.lastSchemaRefreshAt) : 'Never'}
          />
          <LabelValuePair label="Created At" value={formatDate(folder.createdAt)} />
          <LabelValuePair label="Updated At" value={formatDate(folder.updatedAt)} />
        </Stack>
      </Group>
      {folder.schema && (
        <Stack gap="xs">
          <TextTitle3>Schema</TextTitle3>
          <Code block>{JSON.stringify(folder.schema, null, 2)}</Code>
        </Stack>
      )}
    </Stack>
  );
};
