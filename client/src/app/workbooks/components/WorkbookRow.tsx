import { ButtonPrimaryLight, ButtonSecondaryOutline } from '@/app/components/base/buttons';
import { Text13Medium } from '@/app/components/base/text';
import { ConnectorIcon } from '@/app/components/ConnectorIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useWorkbooks } from '@/hooks/use-workbooks';
import { Workbook } from '@/types/server-entities/workbook';
import { RouteUrls } from '@/utils/route-urls';
import { Group, Modal, Stack, Table, Text, TextInput, useModalsStack } from '@mantine/core';
import { Edit3, Table2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { StyledLucideIcon } from '../../components/Icons/StyledLucideIcon';
import { RelativeDate } from '../../components/RelativeDate';
import { ToolbarIconButton } from '../../components/ToolbarIconButton';

export const WorkbookRow = ({ workbook }: { workbook: Workbook }) => {
  const router = useRouter();
  const { deleteWorkbook, updateWorkbook } = useWorkbooks();
  const [saving, setSaving] = useState(false);
  const [workbookName, setWorkbookName] = useState(workbook.name ?? undefined);
  const modalStack = useModalsStack(['confirm-delete', 'rename']);

  const connectorList = [
    ...new Set(workbook.snapshotTables?.map((table) => table.connectorService).filter((service) => !!service)),
  ];

  const handleAbandon = async () => {
    if (!workbook) return;
    try {
      setSaving(true);
      await deleteWorkbook(workbook.id);
      ScratchpadNotifications.success({
        title: 'Workbook abandoned',
        message: 'The workbook and its data have been deleted.',
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
      <Modal {...modalStack.register('confirm-delete')} title="Abandon workbook" centered size="lg">
        <Stack>
          <Text>Are you sure you want to abandon this workbook? All data will be deleted.</Text>
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close('confirm-delete')}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleAbandon} loading={saving}>
              Delete
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
      <Modal {...modalStack.register('rename')} title="Rename workbook" centered size="lg">
        <Stack>
          <TextInput label="Name" value={workbookName} onChange={(e) => setWorkbookName(e.target.value)} />
          <Group justify="flex-end">
            <ButtonSecondaryOutline onClick={() => modalStack.close('rename')}>Cancel</ButtonSecondaryOutline>
            <ButtonPrimaryLight onClick={handleRename} loading={saving}>
              Save
            </ButtonPrimaryLight>
          </Group>
        </Stack>
      </Modal>
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
            {connectorList.map((table, index) => (
              <ConnectorIcon key={index} connector={table} size={21} withBorder />
            ))}
          </Group>
        </Table.Td>
        <Table.Td>
          <RelativeDate date={workbook.createdAt} />
        </Table.Td>
        <Table.Td>
          <Group gap="xs" justify="flex-end" onClick={(e) => e.stopPropagation()}>
            <ToolbarIconButton icon={Edit3} onClick={() => modalStack.open('rename')} title="Rename workbook" />
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
