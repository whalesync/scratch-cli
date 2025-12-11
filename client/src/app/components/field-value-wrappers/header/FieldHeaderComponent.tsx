import { Text13Regular } from '@/app/components/base/text';
import { ChangeDotsGroup } from '@/app/components/field-value-wrappers/ChangeDotsGroup/ChangeDotsGroup';
import { hasAnyChange } from '@/app/components/field-value-wrappers/ProcessedFieldValue';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { ColumnSpec, SnapshotRecord } from '@/types/server-entities/workbook';
import { Box, Group, Tooltip } from '@mantine/core';
import { SnapshotTableId } from '@spinner/shared-types';
import { IHeaderParams } from 'ag-grid-community';
import isEqual from 'lodash/isEqual';
import { AlertCircle, EyeOffIcon, PenOffIcon } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useActiveWorkbook } from '../../../../hooks/use-active-workbook';
import styles from './FieldHeaderComponent.module.css';
import { HeaderMenu } from './FieldHeaderMenu';

interface CustomHeaderComponentProps extends IHeaderParams {
  tableId?: SnapshotTableId;
  records?: SnapshotRecord[];
  columnSpec?: ColumnSpec;
}

export const CustomHeaderComponent: React.FC<CustomHeaderComponentProps> = (props) => {
  const [isHovered, setIsHovered] = useState(false);
  const [currentSort, setCurrentSort] = useState(props.column.getSort());

  const { workbook, updateColumnSettings, hideColumn, unhideColumn } = useActiveWorkbook();
  const { acceptCellValues, rejectCellValues, refreshRecords, columnChangeTypes } = useSnapshotTableRecords({
    workbookId: workbook?.id ?? null,
    tableId: props.tableId ?? null,
  });

  // Monitor sort changes and update local state
  useEffect(() => {
    const sortState = props.column.getSort();
    setCurrentSort(sortState);
  }, [props.column]);

  // Also update when any props change (catches external sort changes)
  useEffect(() => {
    const sortState = props.column.getSort();
    if (sortState !== currentSort) {
      setCurrentSort(sortState);
    }
  }, [props.column, currentSort]);

  // Listen for sort changes from grid API if available
  useEffect(() => {
    if (props.api) {
      const handleSortChanged = () => {
        const actualSort = props.column.getSort();
        setCurrentSort(actualSort);
      };

      props.api.addEventListener('sortChanged', handleSortChanged);

      return () => {
        props.api?.removeEventListener('sortChanged', handleSortChanged);
      };
    }
  }, [props.api, props.column]);

  // Get column information
  const columnId = props.column.getColId();
  const columnName = props.displayName || columnId;

  // Get current column configuration
  const { isColumnHidden, isScratchColumn, currentDataConverter, isTitleColumn } = useMemo(() => {
    const isScratchColumn = props.columnSpec?.metadata?.scratch ?? false;
    const currentTable = props.tableId ? workbook?.snapshotTables?.find((t) => t.id === props.tableId) : undefined;
    const isColumnHidden = currentTable?.hiddenColumns?.includes(columnId) ?? false;
    const currentDataConverter = currentTable?.columnSettings?.[columnId]?.dataConverter ?? '';
    const isTitleColumn = isEqual(currentTable?.tableSpec?.titleColumnRemoteId, props.columnSpec?.id?.remoteId);
    return { isScratchColumn, isColumnHidden, currentDataConverter, isTitleColumn };
  }, [workbook, props.tableId, columnId, props.columnSpec]);

  const handleHeaderClick = () => {
    // Toggle sort when clicking on header text
    let newSort: 'asc' | 'desc' | null;
    if (currentSort === 'asc') {
      newSort = 'desc';
    } else if (currentSort === 'desc') {
      newSort = null;
    } else {
      newSort = 'asc';
    }

    // Update AG Grid sort
    props.setSort(newSort);

    // Update local state immediately for instant UI feedback
    setCurrentSort(newSort);
  };

  const infoIcons = (
    <>
      {props.enableSorting && (currentSort === 'asc' || currentSort === 'desc') && (
        <Box c="var(--fg-secondary)" style={{ flexShrink: 0 }}>
          {currentSort === 'asc' && '↑'}
          {currentSort === 'desc' && '↓'}
        </Box>
      )}
      {/* Column extra info, e.g. required */}
      {props.columnSpec?.required && (
        // {true && (
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px', gap: '2px' }}>
          <Tooltip label="This field is required" position="top" withArrow>
            <span style={{ marginLeft: '2px', display: 'flex', alignItems: 'center' }}>
              <AlertCircle size={12} />
            </span>
          </Tooltip>
        </div>
      )}

      {props.columnSpec?.readonly && (
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px', gap: '2px' }}>
          <Tooltip label="This field is readonly" position="top" withArrow>
            <span style={{ marginLeft: '2px', display: 'flex', alignItems: 'center' }}>
              <PenOffIcon size={12} />
            </span>
          </Tooltip>
        </div>
      )}

      {isColumnHidden && (
        <span title="Column is hidden">
          <EyeOffIcon size={12} />
        </span>
      )}
    </>
  );

  return (
    <Group
      className={styles.fieldHeader}
      wrap="nowrap"
      gap="xs"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={props.enableSorting ? handleHeaderClick : undefined}
    >
      {/* Column change indicators */}
      {columnChangeTypes[columnId] && hasAnyChange(columnChangeTypes[columnId]) && (
        <Box style={{ flexShrink: 0 }}>
          <ChangeDotsGroup changeTypes={columnChangeTypes[columnId]} />
        </Box>
      )}
      <Text13Regular
        c="var(--fg-secondary)"
        style={{
          overflow: 'hidden',
          minWidth: 0,
          flexShrink: 1,
          flexGrow: 0,
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {props.displayName}
      </Text13Regular>

      {infoIcons}

      <HeaderMenu
        isHovered={isHovered}
        tableId={props.tableId}
        columnId={columnId}
        displayName={columnName}
        columnSpec={props.columnSpec}
        records={props.records}
        enableSorting={props.enableSorting}
        currentSort={currentSort ?? null}
        setSort={props.setSort}
        isColumnHidden={isColumnHidden}
        isScratchColumn={isScratchColumn}
        isTitleColumn={isTitleColumn}
        currentDataConverter={currentDataConverter}
        workbook={workbook}
        updateColumnSettings={updateColumnSettings}
        hideColumn={hideColumn}
        unhideColumn={unhideColumn}
        acceptCellValues={acceptCellValues}
        rejectCellValues={rejectCellValues}
        refreshRecords={refreshRecords}
      />
    </Group>
  );
};
