import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { ActionIcon, Menu } from '@mantine/core';
import { DotsThree } from '@phosphor-icons/react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { AG } from './ag-grid-constants';
import styles from './SelectionCorners.module.css';

export const useMenuColDef = () => {
  // Menu cell renderer
  const menuCellRenderer = (params: ICellRendererParams<SnapshotRecord, unknown>) => {
    const record = params.data as SnapshotRecord;

    const handleMenuClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
    };

    const handleMenuAction = (action: string) => {
      console.debug(`${action} record:`, record);
    };

    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          width: '100%',
        }}
        onClick={handleMenuClick}
      >
        <Menu shadow="md" width={200} position="bottom-end">
          <Menu.Target>
            <ActionIcon variant="subtle" size="sm" onClick={handleMenuClick} onMouseDown={handleMenuClick}>
              <DotsThree size={16} />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Actions</Menu.Label>
            <Menu.Item onClick={() => handleMenuAction('Edit')}>Edit</Menu.Item>
            <Menu.Item onClick={() => handleMenuAction('Duplicate')}>Duplicate</Menu.Item>
            <Menu.Item onClick={() => handleMenuAction('Delete')} color="red">
              Delete
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>More</Menu.Label>
            <Menu.Item onClick={() => handleMenuAction('Export')}>Export</Menu.Item>
            <Menu.Item onClick={() => handleMenuAction('View details')}>View Details</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    );
  };

  // Menu column definition
  const menuColumn: ColDef = {
    field: 'menu',
    headerName: '',
    sortable: false,
    filter: false,
    resizable: false,
    pinned: 'right',
    lockPinned: true,
    width: 60,
    minWidth: 60,
    maxWidth: 60,
    cellRenderer: menuCellRenderer,
    suppressKeyboardEvent: () => true,
    suppressNavigable: true,
    cellClass: (params) => {
      return params.api
        .getCellRanges()
        ?.some(
          (range) =>
            range.columns.some((col) => col.getColId() === 'menu') &&
            range.startRow?.rowIndex !== undefined &&
            range.endRow?.rowIndex !== undefined &&
            params.node.rowIndex! >= range.startRow.rowIndex &&
            params.node.rowIndex! <= range.endRow.rowIndex,
        )
        ? styles['selected-cell-corners']
        : '';
    },
    cellStyle: () => ({
      background: `linear-gradient(to left, ${AG.colors.outerBorder} 0px, ${AG.colors.outerBorder} ${AG.borders.outerBorderWidth}, transparent ${AG.borders.outerBorderWidth})`,
      backgroundSize: `${AG.borders.outerBorderWidth} ${AG.borders.outerBorderHeight}`,
      backgroundPosition: 'right center',
      backgroundRepeat: 'no-repeat',
      paddingRight: AG.borders.paddingLeft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
  };

  return { menuColumn };
};
