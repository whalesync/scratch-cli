import { Text12Regular } from '@/app/components/base/text';
import { StyledIcon } from '@/app/components/Icons/StyledIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useAgentChatContext } from '@/app/workbooks/[...slug]/components/contexts/agent-chat-context';
import { usePromptAssets } from '@/hooks/use-prompt-assets';
import {
  trackAddResourceToChat,
  trackClickCreateResourceInChat,
  trackClickViewResourceFromChat,
  trackRemoveResourceFromChat,
} from '@/lib/posthog';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { Workbook } from '@/types/server-entities/workbook';
import { ActionIcon, CloseButton, Combobox, Divider, Group, Stack, useCombobox } from '@mantine/core';
import { FileIcon, PlusIcon } from '@phosphor-icons/react';
import { AtSignIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditResourceModal } from '../../../../components/EditResourceModal';
import styles from './PromptAssetSelector.module.css';

export function PromptAssetSelector({
  disabled,
  workbook,
  resetInputFocus,
}: {
  disabled: boolean;
  workbook?: Workbook;
  resetInputFocus: () => void;
}) {
  const { promptAssets, mutate: refreshResourceList } = usePromptAssets();
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      resetInputFocus();
    },
  });
  const { activeResources, setActiveResources } = useAgentChatContext();
  const [isEditResourceModalOpen, setIsEditResourceModalOpen] = useState(false);
  const [resourceToEdit, setResourceToEdit] = useState<StyleGuide | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        combobox.openDropdown('keyboard');
        combobox.focusTarget();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [combobox, resetInputFocus]);

  const comboBoxOptions = useMemo(() => {
    const list = promptAssets
      .filter((sg) => !activeResources.includes(sg.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((promptAsset) => (
        <Combobox.Option value={promptAsset.id} key={promptAsset.id}>
          <Group gap="4px">
            <StyledIcon Icon={FileIcon} size={14} />
            <Text12Regular>{promptAsset.name}</Text12Regular>
          </Group>
        </Combobox.Option>
      ));
    if (list.length > 0) {
      list.push(
        <Combobox.Option value="divider" key="divider" disabled>
          <Divider />
        </Combobox.Option>,
      );
    }
    list.push(
      <Combobox.Option value="new" key="new">
        <Group gap="4px">
          <StyledIcon Icon={PlusIcon} size={14} />
          <Text12Regular>New prompt asset...</Text12Regular>
        </Group>
      </Combobox.Option>,
    );
    return list;
  }, [promptAssets, activeResources]);

  const handleRemove = useCallback(
    (resourceId: string) => {
      trackRemoveResourceFromChat(workbook);
      setActiveResources(activeResources.filter((id) => id !== resourceId));
    },
    [activeResources, setActiveResources, workbook],
  );

  const handleAdd = useCallback(
    (resourceId: string) => {
      if (resourceId === 'new') {
        trackClickCreateResourceInChat(workbook);
        setIsEditResourceModalOpen(true);
        setResourceToEdit(null);
      } else {
        trackAddResourceToChat(workbook);
        setActiveResources([...activeResources, resourceId]);
      }
      combobox.closeDropdown();
      resetInputFocus();
    },
    [combobox, resetInputFocus, workbook, setActiveResources, activeResources],
  );

  const selectedResources = promptAssets.filter((p) => activeResources.includes(p.id));

  return (
    <>
      <EditResourceModal
        opened={isEditResourceModalOpen}
        onClose={() => {
          setIsEditResourceModalOpen(false);
          setResourceToEdit(null);
        }}
        resourceDocument={resourceToEdit}
        onSuccess={async (newStyleGuide, isNewResource) => {
          await refreshResourceList();
          setIsEditResourceModalOpen(false);

          if (isNewResource && !activeResources.includes(newStyleGuide.id)) {
            setActiveResources([...activeResources, newStyleGuide.id]);
          }
        }}
      />

      <Stack gap="xs">
        <Group gap="xs">
          <Combobox
            store={combobox}
            width={250}
            withArrow
            withinPortal={false}
            onOptionSubmit={(val) => {
              handleAdd(val);
            }}
            disabled={disabled}
            zIndex={1001}
          >
            <Combobox.Target>
              <ActionIcon
                variant="transparent-hover"
                size="sm"
                color="gray"
                onClick={() => combobox.toggleDropdown()}
                disabled={disabled}
              >
                <StyledLucideIcon Icon={AtSignIcon} size={14} />
              </ActionIcon>
            </Combobox.Target>

            <Combobox.Dropdown>
              <Combobox.Options>{comboBoxOptions}</Combobox.Options>
            </Combobox.Dropdown>
          </Combobox>
          {selectedResources.map((sg) => (
            <ResourcePill
              key={sg.id}
              resource={sg}
              onRemove={() => handleRemove(sg.id)}
              onClick={() => {
                trackClickViewResourceFromChat(workbook);
                setResourceToEdit(sg);
                setIsEditResourceModalOpen(true);
              }}
            />
          ))}
        </Group>
      </Stack>
    </>
  );
}

export const ResourcePill = ({
  resource,
  onRemove,
  onClick,
}: {
  resource: StyleGuide;
  onRemove: () => void;
  onClick: () => void;
}) => {
  return (
    <Group p="2px" gap="2xs" wrap="nowrap" className={styles.pill} onClick={onClick}>
      <StyledIcon Icon={FileIcon} size={14} />
      <Text12Regular>{resource.name}</Text12Regular>
      <CloseButton
        size="xs"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      />
    </Group>
  );
};
