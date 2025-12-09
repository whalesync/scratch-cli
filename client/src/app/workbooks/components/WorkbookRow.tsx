import { Badge } from '@/app/components/base/badge';
import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Medium } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/Icons/ConnectorIcon';
import { DeletedConnectionIcon } from '@/app/components/Icons/DeletedConnectionIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ModalWrapper } from '@/app/components/ModalWrapper';
import { RelativeDate } from '@/app/components/RelativeDate';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ToolbarIconButton } from '@/app/components/ToolbarIconButton';
import { useWorkbooks } from '@/hooks/use-workbooks';
import { hasAllConnectionsDeleted, hasDeletedServiceConnection, Workbook } from '@/types/server-entities/workbook';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Stack, Table, Text, TextInput, useModalsStack } from '@mantine/core';
import { Edit3Icon, Table2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export const WorkbookRow = ({ workbook }: { workbook: Workbook }) => {
  const router = useRouter();
  const { deleteWorkbook, updateWorkbook } = useWorkbooks();
  const [saving, setSaving] = useState(false);
  const [workbookName, setWorkbookName] = useState(workbook.name ?? undefined);
  const modalStack = useModalsStack(['confirm-delete', 'rename']);

  const connectorList = [
    ...new Set(workbook.snapshotTables?.map((table) => table.connectorService).filter((service) => !!service)),
  ];

  // Check connection health status
  const allConnectionsDeleted = hasAllConnectionsDeleted(workbook);
  const handleDelete = async () => {
    if (!workbook) return;
    try {
      setSaving(true);
      await deleteWorkbook(workbook.id);
      ScratchpadNotifications.success({
        title: 'Workbook deleted',
        message: 'The workbook and its data is now deleted.',
      });
      modalStack.close('confirm-delete');
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Deletion failed',
        message: 'There was an error deleting the workbook.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!workbook) return;
    try {
      setSaving(true);
      await updateWorkbook(workbook.id, { name: workbookName });
      ScratchpadNotifications.success({
        message: 'The workbook has been renamed.',
      });
      modalStack.close('rename');
    } catch (e) {
      console.error(e);
      ScratchpadNotifications.error({
        title: 'Renaming failed',
        message: 'There was an error renaming the workbook.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ModalWrapper
        title="Delete workbook"
        customProps={{
          footer: (
            <>
              <ButtonSecondaryOutline onClick={() => modalStack.close('confirm-delete')}>Cancel</ButtonSecondaryOutline>
              <ButtonPrimaryLight onClick={handleDelete} loading={saving}>
                Delete
              </ButtonPrimaryLight>
            </>
          ),
        }}
        {...modalStack.register('confirm-delete')}
      >
        <Stack>
          <Text>Are you sure you want to abandon this workbook? All data will be deleted.</Text>
        </Stack>
      </ModalWrapper>
      <ModalWrapper
        title="Rename workbook"
        customProps={{
          footer: (
            <>
              <ButtonSecondaryOutline onClick={() => modalStack.close('rename')}>Cancel</ButtonSecondaryOutline>
              <ButtonPrimaryLight onClick={handleRename} loading={saving}>
                Save
              </ButtonPrimaryLight>
            </>
          ),
        }}
        {...modalStack.register('rename')}
      >
        <TextInput label="Name" value={workbookName} onChange={(e) => setWorkbookName(e.target.value)} />
      </ModalWrapper>
      <Table.Tr
        key={workbook.id}
        onClick={() => router.push(RouteUrls.workbookPageUrl(workbook.id))}
        style={{ cursor: 'pointer' }}
      >
        <Table.Td>
          <Text13Medium>
            <StyledLucideIcon Icon={Table2} size={13} centerInText c="gray.7" mr="xs" />
            {workbook.name}
          </Text13Medium>
        </Table.Td>
        <Table.Td>
          {/* Icons are stacked on top of each other with an offset */}
          <Group gap={3}>
            {connectorList.length === 0 ? (
              <Badge color="black">Not set up</Badge>
            ) : allConnectionsDeleted ? (
              <DeletedConnectionIcon />
            ) : (
              connectorList.map((table, index) => {
                const isConnectionDeleted = hasDeletedServiceConnection(workbook, table);
                return isConnectionDeleted ? (
                  <DeletedConnectionIcon key={`${table}-deleted-connection`} />
                ) : (
                  <ConnectorIcon key={index} connector={table} size={21} withBorder />
                );
              })
            )}
          </Group>
        </Table.Td>
        <Table.Td>
          <RelativeDate date={workbook.createdAt} />
        </Table.Td>
        <Table.Td>
          <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
            <ToolbarIconButton icon={Edit3Icon} onClick={() => modalStack.open('rename')} title="Rename workbook" />
            <ToolbarIconButton
              icon={Trash2}
              onClick={() => modalStack.open('confirm-delete')}
              title="Delete workbook"
            />
          </Group>
        </Table.Td>
      </Table.Tr>
    </>
  );
};
