import { ActionIcon, Group, Text } from '@mantine/core';
import { Gear } from '@phosphor-icons/react';
import { IHeaderParams } from 'ag-grid-community';
import { useEffect, useState } from 'react';

interface IdHeaderComponentProps extends IHeaderParams {
  onSettingsClick: () => void;
}

export const IdHeaderComponent = (props: IdHeaderComponentProps) => {
  const [currentSort, setCurrentSort] = useState<'asc' | 'desc' | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Update sort state when column sort changes
  useEffect(() => {
    const updateSort = () => {
      const sort = props.column.getSort();
      setCurrentSort(sort || null);
    };

    // Initial sort state
    updateSort();

    // Listen for sort changes
    const sortChangedListener = () => updateSort();
    props.api.addEventListener('sortChanged', sortChangedListener);

    return () => {
      props.api.removeEventListener('sortChanged', sortChangedListener);
    };
  }, [props.column, props.api]);

  const handleSort = () => {
    const nextSort = currentSort === 'asc' ? 'desc' : currentSort === 'desc' ? null : 'asc';
    props.setSort(nextSort);
  };

  const handleSettingsClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    props.onSettingsClick();
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: '0 8px',
        cursor: 'pointer',
      }}
      onClick={handleSort}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Group gap="xs" style={{ flex: 1 }}>
        <Text size="sm" fw={600}>
          ID
        </Text>

        {/* Sort indicator */}
        {currentSort && <span style={{ fontSize: '12px', color: '#666' }}>{currentSort === 'asc' ? '↑' : '↓'}</span>}
      </Group>

      {/* Settings button - only show on hover */}
      {isHovered && (
        <ActionIcon size="xs" variant="subtle" color="gray" onClick={handleSettingsClick} style={{ flexShrink: 0 }}>
          <Gear size={14} />
        </ActionIcon>
      )}
    </div>
  );
};
