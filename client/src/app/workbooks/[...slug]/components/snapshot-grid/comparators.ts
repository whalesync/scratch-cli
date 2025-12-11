import { ColumnSpec, PostgresColumnType, SnapshotRecord } from '@/types/server-entities/workbook';
import { IRowNode } from 'ag-grid-community';
import toString from 'lodash/toString';

type ColumnDefComparatorFn = (
  valueA: string,
  valueB: string,
  nodeA: IRowNode<SnapshotRecord>,
  nodeB: IRowNode<SnapshotRecord>,
  isDescending: boolean,
) => number;

export const getComparatorFunctionForColumnSpec = (columnSpec: ColumnSpec): ColumnDefComparatorFn => {
  return (
    valueA: string,
    valueB: string,
    nodeA: IRowNode<SnapshotRecord>,
    nodeB: IRowNode<SnapshotRecord>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    isDescending: boolean, //Don't use this to reverse the logic of the comparison
  ) => {
    // if a record has suggested values, use them for sorting otherwise use the base value provided
    const suggestedValueA = nodeA.data?.__suggested_values?.[columnSpec.id.wsId] as string | undefined;
    const suggestedValueB = nodeB.data?.__suggested_values?.[columnSpec.id.wsId] as string | undefined;

    // Force conversion to string for all values, preserving null and undefined values
    // We can convert back to the original type for special comparisons after checking for undefined/null
    const valueToCompareA =
      (suggestedValueA ? toString(suggestedValueA) : suggestedValueA) || (valueA ? toString(valueA) : valueA);
    const valueToCompareB =
      (suggestedValueB ? toString(suggestedValueB) : suggestedValueB) || (valueB ? toString(valueB) : valueB);

    if (valueToCompareA === valueToCompareB) {
      // suggested values are lower priority than the base value, so use that to break ties
      if (suggestedValueA === undefined && suggestedValueB === undefined) {
        // comparing base values, no preference
        return 0;
      }
      if (suggestedValueA === undefined || suggestedValueA === null) {
        // A has no suggested value, B has a suggested value, so A is higher priority
        return 1;
      }
      if (suggestedValueB === undefined || suggestedValueB === null) {
        // B has no suggested value, A has a suggested value, so B is higher priority
        return -1;
      }
      // both have suggested values, no preference
      return 0;
    }

    if (valueToCompareA === undefined || valueToCompareA === null) {
      return -1;
    }
    if (valueToCompareB === undefined || valueToCompareB === null) {
      return 1;
    }

    if (columnSpec.pgType === PostgresColumnType.TIMESTAMP) {
      const dateValueA = new Date(valueToCompareA);
      const dateValueB = new Date(valueToCompareB);
      return dateValueA.getTime() - dateValueB.getTime();
    }

    if (columnSpec.pgType === PostgresColumnType.NUMERIC) {
      const numericValueA = parseFloat(valueToCompareA);
      const numericValueB = parseFloat(valueToCompareB);

      // Handle NaN cases - treat them as undefined for sorting purposes
      if (isNaN(numericValueA) && isNaN(numericValueB)) {
        return 0;
      }
      if (isNaN(numericValueA)) {
        return -1;
      }
      if (isNaN(numericValueB)) {
        return 1;
      }

      const comparison = numericValueA - numericValueB;
      return comparison;
    }

    if (columnSpec.pgType === PostgresColumnType.BOOLEAN) {
      const booleanValueA = valueToCompareA === 'true' ? 1 : 0;
      const booleanValueB = valueToCompareB === 'true' ? 1 : 0;
      return booleanValueA - booleanValueB;
    }

    return valueToCompareA.localeCompare(valueToCompareB);
  };
};
