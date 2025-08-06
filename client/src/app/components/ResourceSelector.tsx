import { useStyleGuides } from '@/hooks/use-style-guide';
import { StyleGuide } from '@/types/server-entities/style-guide';
import { FileIcon, PlusIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { CustomPillMultiSelect, CustomPillMultiSelectData } from './CustomPillMultiSelect';
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

  const listValues = useMemo<CustomPillMultiSelectData[]>(() => {
    const list: CustomPillMultiSelectData[] = styleGuides
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((styleGuide) => ({
        value: styleGuide.id,
        label: styleGuide.name,
        disabled: false,
        icon: <FileIcon />,
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
      icon: <PlusIcon />,
    });
    return list;
  }, [styleGuides]);

  return (
    <>
      <EditResourceModal
        opened={isEditResourceModalOpen}
        onClose={() => {
          setIsEditResourceModalOpen(false);
          setResourceToEdit(null);
        }}
        styleGuide={resourceToEdit}
        onSuccess={async (newStyleGuide, isNewResource) => {
          await refreshResourceList();
          setIsEditResourceModalOpen(false);

          if (isNewResource && !selectedStyleGuideIds.includes(newStyleGuide.id)) {
            setSelectedStyleGuideIds([...selectedStyleGuideIds, newStyleGuide.id]);
          }
        }}
      />

      <CustomPillMultiSelect
        values={selectedStyleGuideIds}
        data={listValues}
        placeholder="Select resources (optional)"
        hidePickedOptions
        onPillClick={(value) => {
          if (value !== 'new') {
            const styleGuide = styleGuides.find((sg) => sg.id === value);
            if (styleGuide) {
              setResourceToEdit(styleGuide);
              setIsEditResourceModalOpen(true);
            }
          }
        }}
        onSelect={(value) => {
          if (value === 'new') {
            setIsEditResourceModalOpen(true);
            setResourceToEdit(null);
          } else if (value !== 'divider') {
            setSelectedStyleGuideIds([...selectedStyleGuideIds, value]);
          }
        }}
        onRemove={(value) => {
          if (value !== 'new') {
            setSelectedStyleGuideIds(selectedStyleGuideIds.filter((id) => id !== value));
          }
        }}
      />
    </>
  );
}
