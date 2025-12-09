import { IHeaderParams } from 'ag-grid-community';
import { useEffect, useState } from 'react';
import { Text13Regular } from '../../base/text';

interface IdHeaderComponentProps extends IHeaderParams {
  entityName: string;
}

export const IdHeaderComponent = (props: IdHeaderComponentProps) => {
  const [currentSort, setCurrentSort] = useState<'asc' | 'desc' | null>(null);

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

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        height: '100%',
        cursor: 'pointer',
        paddingLeft: '8px',
      }}
      onClick={handleSort}
    >
      <Text13Regular c="var(--fg-secondary)">{`${props.entityName.charAt(0).toUpperCase()}${props.entityName.slice(1)} ID`}</Text13Regular>

      {/* Sort indicator */}
      {currentSort && (
        <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>{currentSort === 'asc' ? '↑' : '↓'}</span>
      )}
    </div>
  );
};
