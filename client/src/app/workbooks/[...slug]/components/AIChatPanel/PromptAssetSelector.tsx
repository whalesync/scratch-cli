import { Text12Regular } from '@/app/components/base/text';
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
import { AtSignIcon, FileIcon, PlusIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { PromptAssetDetailModal, useEditAssetModal } from '../../../../components/PromptAssetDetailModal';
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
  const resourceModal = useEditAssetModal();
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      resetInputFocus();
    },
  });
  const { activeResources, setActiveResources } = useAgentChatContext();

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
            <StyledLucideIcon Icon={FileIcon} size={14} />
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
          <StyledLucideIcon Icon={PlusIcon} size={14} />
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
        resourceModal.open('new-text'); // Could also be 'new-url'
      } else {
        trackAddResourceToChat(workbook);
        setActiveResources([...activeResources, resourceId]);
      }
      combobox.closeDropdown();
      resetInputFocus();
    },
    [combobox, resetInputFocus, workbook, setActiveResources, activeResources, resourceModal],
  );

  const selectedResources = promptAssets.filter((p) => activeResources.includes(p.id));

  return (
    <>
      <PromptAssetDetailModal
        {...resourceModal}
        close={(result) => {
          resourceModal.close();
          if (result) {
            if (result.action === 'create' && !activeResources.includes(result.asset.id)) {
              setActiveResources([...activeResources, result.asset.id]);
            }
            refreshResourceList();
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
                resourceModal.open(sg);
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
      <StyledLucideIcon Icon={FileIcon} size={14} />
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
