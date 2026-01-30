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
import { getConnectorsWithStatus } from '@/types/server-entities/workbook';
import { Group, Menu, Stack, Table, Text, TextInput, useModalsStack } from '@mantine/core';
import { Workbook } from '@spinner/shared-types';
import { Edit3Icon, Table2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export const WorkbookRow = ({ workbook }: { workbook: Workbook }) => {
  const router = useRouter();
  const { deleteWorkbook, updateWorkbook, getWorkbookPageUrl } = useWorkbooks();
  const [saving, setSaving] = useState(false);
  const [workbookName, setWorkbookName] = useState(workbook.name ?? undefined);
  const modalStack = useModalsStack(['confirm-delete', 'rename']);
  const connectorList = getConnectorsWithStatus(workbook);

  const [contextMenuOpened, setContextMenuOpened] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

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

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpened(true);
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

      <Menu opened={contextMenuOpened} onChange={setContextMenuOpened} withinPortal shadow="md">
        <Menu.Target>
          <div
            style={{
              position: 'fixed',
              top: contextMenuPosition.y,
              left: contextMenuPosition.x,
              width: 0,
              height: 0,
              visibility: 'hidden',
            }}
          />
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<Edit3Icon size={16} />} onClick={() => modalStack.open('rename')}>
            Rename workbook
          </Menu.Item>
          <Menu.Divider />
          <Menu.Item
            color="red"
            leftSection={<Trash2 size={16} />}
            onClick={() => modalStack.open('confirm-delete')}
            disabled={saving}
          >
            Delete workbook
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Table.Tr
        key={workbook.id}
        onClick={() => router.push(getWorkbookPageUrl(workbook.id))}
        onContextMenu={onContextMenu}
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
            {connectorList.map(({ connectorService, isBroken }, index) => {
              return isBroken ? (
                <DeletedConnectionIcon key={index} />
              ) : (
                <ConnectorIcon key={index} connector={connectorService} size={21} withBorder />
              );
            })}
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
