import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { workbookApi } from '@/lib/api/workbook';
import { ColumnSpec, SnapshotRecord } from '@/types/server-entities/workbook';
import { getColumnTypeIcon } from '@/utils/columns';
import { Group, Radio, Tooltip } from '@mantine/core';
import { IHeaderParams } from 'ag-grid-community';
import {
  AlertCircle,
  EyeIcon,
  EyeOff,
  EyeOffIcon,
  List,
  ListChecks,
  MoreVertical,
  Star,
  TrashIcon,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useActiveWorkbook } from '../../../../../hooks/use-active-workbook';
import { SnapshotTableId } from '@spinner/shared-types';

interface CustomHeaderComponentProps extends IHeaderParams {
  tableId?: SnapshotTableId;
  records?: SnapshotRecord[];
  columnSpec?: ColumnSpec;
  showDataTypeInHeader?: boolean;
}

export const CustomHeaderComponent: React.FC<CustomHeaderComponentProps> = (props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentSort, setCurrentSort] = useState(props.column.getSort());
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { workbook, updateColumnSettings, hideColumn, unhideColumn } = useActiveWorkbook();
  const { acceptCellValues, rejectCellValues, refreshRecords } = useSnapshotTableRecords({
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

  // Check if any record has suggestions for this column
  const recordsWithSuggestions = (props.records || []).filter((record) => {
    const suggestedValues = record.__suggested_values || {};
    return suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined;
  });
  const hasColumnSuggestions = recordsWithSuggestions.length > 0;

  const hasDataConverterTypes = props.columnSpec?.dataConverterTypes && props.columnSpec.dataConverterTypes.length > 0;

  // Get current column configuration
  const { currentTable, isColumnHidden, isScratchColumn, currentDataConverter } = useMemo(() => {
    const isScratchColumn = props.columnSpec?.metadata?.scratch ?? false;
    const currentTable = props.tableId ? workbook?.snapshotTables?.find((t) => t.id === props.tableId) : undefined;
    const isColumnHidden = currentTable?.hiddenColumns?.includes(columnId) ?? false;
    const currentDataConverter = currentTable?.columnSettings?.[columnId]?.dataConverter ?? '';
    return { isScratchColumn, currentTable, isColumnHidden, currentDataConverter };
  }, [workbook, props.tableId, columnId, props.columnSpec]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMenuClick = () => {
    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 2,
        right: window.innerWidth - rect.right,
      });
    }
    setIsMenuOpen(!isMenuOpen);
  };

  const handleAcceptColumn = async () => {
    if (recordsWithSuggestions.length === 0) {
      ScratchpadNotifications.warning({
        title: 'Accept Column',
        message: `No suggestions found for column "${columnName}"`,
      });
      setIsMenuOpen(false);
      return;
    }

    try {
      setIsProcessing(true);
      setIsMenuOpen(false);

      const items = recordsWithSuggestions.map((record) => ({
        wsId: record.id.wsId,
        columnId,
      }));

      await acceptCellValues(items);
      ScratchpadNotifications.success({
        title: 'Accept Column',
        message: `Accepted ${recordsWithSuggestions.length} suggestion${recordsWithSuggestions.length > 1 ? 's' : ''} for column "${columnName}"`,
      });
      await refreshRecords();
    } catch (error) {
      console.error('Error accepting column:', error);
      ScratchpadNotifications.error({
        title: 'Error accepting column',
        message: error instanceof Error ? error.message : 'Failed to accept column suggestions',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectColumn = async () => {
    if (recordsWithSuggestions.length === 0) {
      ScratchpadNotifications.warning({
        title: 'Reject Column',
        message: `No suggestions found for column "${columnName}"`,
      });
      setIsMenuOpen(false);
      return;
    }

    try {
      setIsProcessing(true);
      setIsMenuOpen(false);

      const items = recordsWithSuggestions.map((record) => ({
        wsId: record.id.wsId,
        columnId,
      }));

      await rejectCellValues(items);
      ScratchpadNotifications.success({
        title: 'Reject Column',
        message: `Rejected ${recordsWithSuggestions.length} suggestion${recordsWithSuggestions.length > 1 ? 's' : ''} for column "${columnName}"`,
      });
      await refreshRecords();
    } catch (error) {
      console.error('Error rejecting column:', error);
      ScratchpadNotifications.error({
        title: 'Error rejecting column',
        message: error instanceof Error ? error.message : 'Failed to reject column suggestions',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataConverterChange = async (value: string) => {
    if (!workbook || !props.tableId) {
      return;
    }

    try {
      await updateColumnSettings(props.tableId, {
        [columnId]: {
          dataConverter: value,
        },
      });

      ScratchpadNotifications.success({
        title: 'Data Converter Updated',
        message: `Column "${columnName}" converter set to ${value || 'Default'}. Please download your records again to see the changes.`,
      });
    } catch (error) {
      console.error('Error updating data converter:', error);
      ScratchpadNotifications.error({
        title: 'Error updating data converter',
        message: error instanceof Error ? error.message : 'Failed to update data converter',
      });
    }
  };

  const handleToggleColumnVisibility = async () => {
    if (!workbook || !props.tableId) {
      return;
    }

    try {
      setIsProcessing(true);
      setIsMenuOpen(false);
      if (currentTable?.hiddenColumns?.includes(columnId)) {
        await unhideColumn(props.tableId, columnId);
      } else {
        await hideColumn(props.tableId, columnId);
      }

      ScratchpadNotifications.success({
        title: 'Column Visibility Changed',
        message: `Column "${columnName}" is now ${currentTable?.hiddenColumns?.includes(columnId) ? 'hidden from ' : 'visible to '} the agent`,
      });
    } catch (error) {
      console.error('Error changing column visibility:', error);
      ScratchpadNotifications.error({
        title: 'Error changing column visibility',
        message: error instanceof Error ? error.message : 'Failed to change column visibility',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetTitleColumn = async () => {
    try {
      setIsProcessing(true);
      setIsMenuOpen(false);

      if (!workbook || !props.tableId) {
        ScratchpadNotifications.error({
          title: 'Error',
          message: 'Missing workbook or table information',
        });
        return;
      }

      // Call the API to set the title column
      await workbookApi.setTitleColumn(workbook.id, props.tableId, columnId);

      ScratchpadNotifications.success({
        title: 'Title Column Set',
        message: `Column "${columnName}" is now the title column for this table`,
      });
    } catch (error) {
      console.error('Error setting title column:', error);
      ScratchpadNotifications.error({
        title: 'Error setting title column',
        message: error instanceof Error ? error.message : 'Failed to set title column',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveScratchColumn = async () => {
    try {
      setIsProcessing(true);
      setIsMenuOpen(false);

      if (!workbook || !props.tableId) {
        ScratchpadNotifications.error({
          title: 'Error',
          message: 'Missing workbook or table information',
        });
        return;
      }

      await workbookApi.removeScratchColumn(workbook.id, props.tableId, {
        columnId,
      });

      ScratchpadNotifications.success({
        title: 'Scratch Column Removed',
        message: `Column "${columnName}" has been removed from the table`,
      });
    } catch (error) {
      ScratchpadNotifications.error({
        title: `Error removing scratch column "${columnName}"`,
        message: error instanceof Error ? error.message : 'Failed to remove scratch column',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const onSortChanged = () => {
    props.setSort('asc');
  };

  const onSortRemoved = () => {
    props.setSort(null);
  };

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

  return (
    <div
      className="ag-header-cell-comp-wrapper"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: '100%' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header label - clickable for sorting */}
      <div
        className="ag-header-cell-label"
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          cursor: props.enableSorting ? 'pointer' : 'default',
        }}
        onClick={props.enableSorting ? handleHeaderClick : undefined}
      >
        {/* Column type icon */}
        {props.columnSpec && props.showDataTypeInHeader && (
          <span style={{ marginRight: '6px', display: 'flex', alignItems: 'center' }}>
            {getColumnTypeIcon(props.columnSpec.pgType)}
          </span>
        )}

        <span className="ag-header-cell-text">{props.displayName}</span>
        {/* Column extra info, e.g. required */}
        {props.columnSpec?.required && (
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px', gap: '2px' }}>
            <Tooltip label="This field is required" position="top" withArrow>
              <span style={{ marginLeft: '2px', display: 'flex', alignItems: 'center' }}>
                <StyledLucideIcon Icon={AlertCircle} size={12} />
              </span>
            </Tooltip>
          </div>
        )}
        {/* Column state icons */}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px', gap: '2px' }}>
          {isColumnHidden && (
            <span title="Column is hidden">
              <StyledLucideIcon Icon={EyeOff} size={12} c="#666" />
            </span>
          )}
          {props.enableSorting && (
            <span className="ag-header-icon ag-sort-icon" style={{ marginLeft: '2px' }}>
              {currentSort === 'asc' && '↑'}
              {currentSort === 'desc' && '↓'}
            </span>
          )}
        </div>
      </div>
      {/* Menu button - only show on hover or when menu is open */}
      {(isHovered || isMenuOpen) && (
        <div style={{ position: 'relative' }}>
          <button
            ref={buttonRef}
            onClick={handleMenuClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '2px',
              opacity: 0.7,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            title="Column menu"
          >
            <StyledLucideIcon Icon={MoreVertical} size={14} />
          </button>

          {/* Dropdown menu */}
          {isMenuOpen && (
            <div
              ref={menuRef}
              style={{
                position: 'fixed',
                top: menuPosition.top,
                right: menuPosition.right,
                backgroundColor: '#2d2d2d',
                border: '1px solid #444',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                zIndex: 10000,
                minWidth: '150px',
                padding: '4px 0',
              }}
            >
              {/* Sort options */}
              {props.enableSorting && (
                <>
                  <button
                    onClick={onSortChanged}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      color: '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Sort Ascending
                  </button>
                  <button
                    onClick={onSortRemoved}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      color: '#ffffff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Clear Sort
                  </button>
                  <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }} />
                </>
              )}

              {hasDataConverterTypes && (
                <>
                  <div style={{ padding: '4px 12px' }}>Data Converter Types</div>
                  <Radio.Group
                    style={{ padding: '4px 12px' }}
                    name="dataConverterType"
                    description="Choose which format you want to convert the column to"
                    withAsterisk
                    value={currentDataConverter}
                    onChange={handleDataConverterChange}
                  >
                    <Group mt="xs">
                      <Radio key={'default'} value={''} label={'Default'} />
                      {props.columnSpec?.dataConverterTypes?.map((type) => (
                        <Radio key={type} value={type} label={type} />
                      ))}
                    </Group>
                  </Radio.Group>
                </>
              )}
              {/* Accept/Reject Column Actions */}
              {hasColumnSuggestions && (
                <>
                  <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }} />
                  <div style={{ padding: '4px 12px', color: '#888', fontSize: '11px', fontWeight: 'bold' }}>
                    Accept/Reject Changes
                  </div>
                  <button
                    onClick={handleAcceptColumn}
                    disabled={isProcessing}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      color: isProcessing ? '#666' : '#ffffff',
                      textAlign: 'left',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <StyledLucideIcon Icon={ListChecks} size={14} c="#00aa00" />
                    Accept Column
                  </button>
                  <button
                    onClick={handleRejectColumn}
                    disabled={isProcessing}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      color: isProcessing ? '#666' : '#ffffff',
                      textAlign: 'left',
                      cursor: isProcessing ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isProcessing) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <StyledLucideIcon Icon={List} size={14} c="#ff0000" />
                    Reject Column
                  </button>
                </>
              )}

              {/* Column View Actions */}
              <div style={{ height: '1px', backgroundColor: '#444', margin: '4px 0' }} />
              <div style={{ padding: '4px 12px', color: '#888', fontSize: '11px', fontWeight: 'bold' }}>
                Column View
              </div>
              <button
                onClick={handleToggleColumnVisibility}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  color: isProcessing ? '#666' : '#ffffff',
                  textAlign: 'left',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {isColumnHidden ? (
                  <StyledLucideIcon Icon={EyeIcon} size={14} c="#888" />
                ) : (
                  <StyledLucideIcon Icon={EyeOffIcon} size={14} c="#888" />
                )}
                {isColumnHidden ? 'Show Column' : 'Hide Column'}
              </button>

              <button
                onClick={handleSetTitleColumn}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'none',
                  border: 'none',
                  color: isProcessing ? '#666' : '#ffffff',
                  textAlign: 'left',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!isProcessing) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <StyledLucideIcon Icon={Star} size={14} c="#ffd700" />
                Set as Title Column
              </button>
              {isScratchColumn && (
                <button
                  onClick={handleRemoveScratchColumn}
                  disabled={isProcessing}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: 'none',
                    border: 'none',
                    color: isProcessing ? '#666' : '#ffffff',
                    textAlign: 'left',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                  onMouseEnter={(e) => {
                    if (!isProcessing) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <StyledLucideIcon Icon={TrashIcon} size={14} c="red" />
                  Remove Scratch Column
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
