import { TextRegularXs } from '@/app/components/base/text';
import { StyledIcon } from '@/app/components/Icons/StyledIcon';
import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { useAgentChatContext } from '@/app/snapshots/[...slug]/components/contexts/agent-chat-context';
import { useStyleGuides } from '@/hooks/use-style-guide';
import {
  trackAddResourceToChat,
  trackClickCreateResourceInChat,
  trackClickViewResourceFromChat,
  trackRemoveResourceFromChat,
} from '@/lib/posthog';
import { Snapshot } from '@/types/server-entities/snapshot';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { ActionIcon, CloseButton, Combobox, Divider, Group, Stack, useCombobox } from '@mantine/core';
import { FileIcon, PlusIcon } from '@phosphor-icons/react';
import { AtSignIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EditResourceModal } from '../../../../components/EditResourceModal';
import styles from './ResourceSelector.module.css';

export function ResourceSelector({ disabled, snapshot }: { disabled: boolean; snapshot?: Snapshot }) {
  const { styleGuides: resources, mutate: refreshResourceList } = useStyleGuides();
  const combobox = useCombobox({ onDropdownClose: () => combobox.resetSelectedOption() });
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
  }, [combobox]);

  const comboBoxOptions = useMemo(() => {
    const list = resources
      .filter((sg) => !activeResources.includes(sg.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((styleGuide) => (
        <Combobox.Option value={styleGuide.id} key={styleGuide.id}>
          <Group gap="4px">
            <StyledIcon Icon={FileIcon} size={14} />
            <TextRegularXs>{styleGuide.name}</TextRegularXs>
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
          <TextRegularXs>New resource...</TextRegularXs>
        </Group>
      </Combobox.Option>,
    );
    return list;
  }, [resources, activeResources]);

  const handleRemove = useCallback(
    (resourceId: string) => {
      trackRemoveResourceFromChat(snapshot);
      setActiveResources(activeResources.filter((id) => id !== resourceId));
    },
    [activeResources, setActiveResources],
  );

  const handleAdd = useCallback(
    (resourceId: string) => {
      if (resourceId === 'new') {
        trackClickCreateResourceInChat(snapshot);
        setIsEditResourceModalOpen(true);
        setResourceToEdit(null);
      } else {
        trackAddResourceToChat(snapshot);
        setActiveResources([...activeResources, resourceId]);
      }
      combobox.closeDropdown();
    },
    [activeResources, setActiveResources, combobox, setIsEditResourceModalOpen, setResourceToEdit],
  );

  const selectedResources = resources.filter((resource) => activeResources.includes(resource.id));

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
                trackClickViewResourceFromChat(snapshot);
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
      <TextRegularXs>{resource.name}</TextRegularXs>
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
