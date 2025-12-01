import { ChangeLinesStack } from '@/app/components/field-value-wrappers/ChangeLinesStack/ChangeLinesStack';
import { ExistingChangeTypes } from '@/app/components/field-value-wrappers/ProcessedFieldValue';
import { IHeaderParams } from 'ag-grid-community';
import { useEffect, useMemo, useState } from 'react';
import { Text13Regular } from '../../base/text';

interface IdHeaderComponentProps extends IHeaderParams {
  entityName: string;
  columnChangeTypes?: Record<string, ExistingChangeTypes>;
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

  // Aggregate all column change types into a single change type for the ID column
  const aggregatedChangeTypes = useMemo(() => {
    if (!props.columnChangeTypes) {
      return {};
    }

    const aggregated: ExistingChangeTypes = {};

    // Aggregate across all columns using OR logic
    Object.values(props.columnChangeTypes).forEach((columnChange) => {
      if (columnChange.suggestedAdditions) {
        aggregated.suggestedAdditions = true;
      }
      if (columnChange.suggestedDeletions) {
        aggregated.suggestedDeletions = true;
      }
      if (columnChange.acceptedAdditions) {
        aggregated.acceptedAdditions = true;
      }
      if (columnChange.acceptedDeletions) {
        aggregated.acceptedDeletions = true;
      }
    });

    return aggregated;
  }, [props.columnChangeTypes]);

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
      }}
      onClick={handleSort}
    >
      <ChangeLinesStack changeTypes={aggregatedChangeTypes} />
      <Text13Regular c="var(--fg-secondary)">{`${props.entityName.charAt(0).toUpperCase()}${props.entityName.slice(1)} ID`}</Text13Regular>

      {/* Sort indicator */}
      {currentSort && (
        <span style={{ fontSize: '12px', color: '#666', marginLeft: '4px' }}>{currentSort === 'asc' ? '↑' : '↓'}</span>
      )}
    </div>
  );
};
