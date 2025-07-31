import {GridColumn} from '@glideapps/glide-data-grid';
import {useCallback} from 'react';
import { useCoreGridState } from './useCoreGridState';
export const useGridHandlers = (coreGridState: ReturnType<typeof useCoreGridState>) => {
    const { setColumnWidths } = coreGridState;
    const onColumnResize = useCallback((column: GridColumn, newSize: number) => {
        if (column.id && column.id !== 'actions') {
            setColumnWidths((prev) => ({ ...prev, [column.id as string]: newSize }));
        }
    }, [setColumnWidths]);
  return {
    onColumnResize,
  };
};