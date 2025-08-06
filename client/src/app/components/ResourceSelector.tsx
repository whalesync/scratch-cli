import { useStyleGuides } from '@/hooks/use-style-guide';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { Divider, Group, MultiSelect, MultiSelectProps, Text } from '@mantine/core';
import { FileIcon, PlusIcon } from '@phosphor-icons/react';
import { useCallback, useMemo, useState } from 'react';
import { EditResourceModal } from './EditResourceModal';

interface ResourceSelectorProps {
  selectedStyleGuideIds: string[];
  setSelectedStyleGuideIds: (value: string[]) => void;
}

export function ResourceSelector(props: ResourceSelectorProps) {
  const { styleGuides, mutate: refreshResourceList } = useStyleGuides();
  const { selectedStyleGuideIds, setSelectedStyleGuideIds } = props;
  const [isEditResourceModalOpen, setIsEditResourceModalOpen] = useState(false);
  const [resourceToEdit, setResourceToEdit] = useState<StyleGuide | null>(null);

  const listValues = useMemo(() => {
    const list = styleGuides
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((styleGuide) => ({
        value: styleGuide.id,
        label: styleGuide.name,
        disabled: false,
      }));
    list.push({
      value: 'divider',
      label: '---',
      disabled: true,
    });
    list.push({
      value: 'new',
      label: 'New',
      disabled: false,
    });
    return list;
  }, [styleGuides]);

  const handleSelect = (value: string[]) => {
    if (value.includes('new')) {
      setIsEditResourceModalOpen(true);
      setResourceToEdit(null);
    } else {
      setSelectedStyleGuideIds(value);
    }
  };
  const renderMultiSelectOption: MultiSelectProps['renderOption'] = useCallback(
    ({ option }: { option: { value: string; label: string } }) => {
      if (option.value === 'divider') {
        return <Divider w="100%" />;
      }
      const styleGuide = styleGuides.find((sg) => sg.id === option.value);
      const icon = styleGuide ? <FileIcon /> : <PlusIcon />;
      return (
        <Group gap="xs">
          {icon}
          <div>
            <Text size="sm">{option.label}</Text>
          </div>
        </Group>
      );
    },
    [styleGuides],
  );

  return (
    <>
      <EditResourceModal
        opened={isEditResourceModalOpen}
        onClose={() => setIsEditResourceModalOpen(false)}
        styleGuide={resourceToEdit}
        onSuccess={(newStyleGuide) => {
          refreshResourceList();
          setIsEditResourceModalOpen(false);
          setSelectedStyleGuideIds([...selectedStyleGuideIds, newStyleGuide.id]);
        }}
      />
      <MultiSelect
        placeholder={selectedStyleGuideIds.length === 0 ? 'Select resources (optional)' : ''}
        value={selectedStyleGuideIds}
        onChange={handleSelect}
        data={listValues}
        size="sm"
        searchable={false}
        clearable={false}
        maxDropdownHeight={200}
        comboboxProps={{ position: 'top', middlewares: { flip: false, shift: false } }}
        renderOption={renderMultiSelectOption}
        hidePickedOptions
        styles={{
          input: {
            border: 'none',
            backgroundColor: 'transparent',
            paddingLeft: '0px',
          },
        }}
      />
    </>
  );
}
