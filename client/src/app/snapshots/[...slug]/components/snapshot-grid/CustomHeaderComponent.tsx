import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshotContext } from '@/app/snapshots/[...slug]/components/contexts/SnapshotContext';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { useUpsertView } from '@/hooks/use-view';
import { snapshotApi } from '@/lib/api/snapshot';
import { ColumnSpec, SnapshotRecord } from '@/types/server-entities/snapshot';
import { getColumnTypeIcon } from '@/utils/columns';
import { Group, Radio } from '@mantine/core';
import { IHeaderParams } from 'ag-grid-community';
import { Eye, EyeOff, List, ListChecks, Lock, MoreVertical, Square, Star } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

// interface CustomHeaderComponentProps extends IHeaderParams {
//   Add any custom props here
// }

interface CustomHeaderComponentProps extends IHeaderParams {
  tableId?: string;
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

  const { snapshot, currentView, currentViewId, viewDataAsAgent, updateColumnContexts } = useSnapshotContext();
  const { acceptCellValues, rejectCellValues, refreshRecords } = useSnapshotTableRecords({
    snapshotId: snapshot?.id ?? '',
    tableId: props.tableId ?? '',
    viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
  });
  const { upsertView } = useUpsertView();

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
  const tableConfig = currentView?.config[props.tableId || ''];
  const columnConfig = tableConfig?.columns?.find((c: { wsId: string }) => c.wsId === columnId);
  const isColumnHidden = columnConfig?.hidden === true;
  const isColumnProtected = columnConfig?.protected === true;

  // Get current data converter setting from snapshot columnContexts
  const currentDataConverter = props.tableId
    ? (snapshot?.columnContexts?.[props.tableId]?.[columnId]?.dataConverter ?? '')
    : '';

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
    if (!snapshot || !props.tableId) {
      return;
    }

    try {
      await updateColumnContexts(props.tableId, {
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
    try {
      setIsProcessing(true);
      setIsMenuOpen(false);

      if (!currentView || !snapshot || !props.tableId) {
        ScratchpadNotifications.error({
          title: 'No View',
          message: 'No active view to update column settings',
        });
        return;
      }

      const existingConfig = currentView.config;
      const tableConfig = existingConfig[props.tableId] || {
        hidden: false,
        protected: false,
        columns: [],
      };

      const columns = tableConfig.columns || [];
      const existingColumnIndex = columns.findIndex((c: { wsId: string }) => c.wsId === columnId);
      const existingColumn = existingColumnIndex >= 0 ? columns[existingColumnIndex] : null;

      let updatedColumn;
      if (isColumnHidden) {
        // Unhide column - remove hidden override, keep protected if it exists
        updatedColumn = {
          wsId: columnId,
          ...(existingColumn?.protected !== undefined && { protected: existingColumn.protected }),
        };
      } else {
        // Hide column
        updatedColumn = {
          wsId: columnId,
          hidden: true,
          ...(existingColumn?.protected !== undefined && { protected: existingColumn.protected }),
        };
      }

      // Update or add the column
      const updatedColumns = [...columns];
      if (existingColumnIndex >= 0) {
        if (Object.keys(updatedColumn).length === 1) {
          // Only has wsId, remove the column entirely
          updatedColumns.splice(existingColumnIndex, 1);
        } else {
          updatedColumns[existingColumnIndex] = updatedColumn;
        }
      } else if (Object.keys(updatedColumn).length > 1) {
        // Only add if it has more than just wsId
        updatedColumns.push(updatedColumn);
      }

      const updatedTableConfig = {
        ...tableConfig,
        columns: updatedColumns,
      };

      const updatedConfig = {
        ...existingConfig,
        [props.tableId]: updatedTableConfig,
      };

      await upsertView({
        id: currentView.id,
        name: currentView.name || undefined,
        snapshotId: snapshot.id,
        config: updatedConfig,
      });

      ScratchpadNotifications.success({
        title: 'Column Updated',
        message: `Column ${isColumnHidden ? 'shown' : 'hidden'}`,
      });
    } catch (error) {
      console.error('Error toggling column visibility:', error);
      ScratchpadNotifications.error({
        title: 'Error updating column',
        message: error instanceof Error ? error.message : 'Failed to update column visibility',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleColumnProtection = async () => {
    try {
      setIsProcessing(true);
      setIsMenuOpen(false);

      if (!currentView || !snapshot || !props.tableId) {
        ScratchpadNotifications.error({
          title: 'No View',
          message: 'No active view to update column settings',
        });
        return;
      }

      const existingConfig = currentView.config;
      const tableConfig = existingConfig[props.tableId] || {
        hidden: false,
        protected: false,
        columns: [],
      };

      const columns = tableConfig.columns || [];
      const existingColumnIndex = columns.findIndex((c: { wsId: string }) => c.wsId === columnId);
      const existingColumn = existingColumnIndex >= 0 ? columns[existingColumnIndex] : null;

      let updatedColumn;
      if (isColumnProtected) {
        // Unprotect column - remove protected override, keep hidden if it exists
        updatedColumn = {
          wsId: columnId,
          ...(existingColumn?.hidden !== undefined && { hidden: existingColumn.hidden }),
        };
      } else {
        // Protect column
        updatedColumn = {
          wsId: columnId,
          protected: true,
          ...(existingColumn?.hidden !== undefined && { hidden: existingColumn.hidden }),
        };
      }

      // Update or add the column
      const updatedColumns = [...columns];
      if (existingColumnIndex >= 0) {
        if (Object.keys(updatedColumn).length === 1) {
          // Only has wsId, remove the column entirely
          updatedColumns.splice(existingColumnIndex, 1);
        } else {
          updatedColumns[existingColumnIndex] = updatedColumn;
        }
      } else if (Object.keys(updatedColumn).length > 1) {
        // Only add if it has more than just wsId
        updatedColumns.push(updatedColumn);
      }

      const updatedTableConfig = {
        ...tableConfig,
        columns: updatedColumns,
      };

      const updatedConfig = {
        ...existingConfig,
        [props.tableId]: updatedTableConfig,
      };

      await upsertView({
        id: currentView.id,
        name: currentView.name || undefined,
        snapshotId: snapshot.id,
        config: updatedConfig,
      });

      ScratchpadNotifications.success({
        title: 'Column Updated',
        message: `Column ${isColumnProtected ? 'unprotected' : 'protected'}`,
      });
    } catch (error) {
      console.error('Error toggling column protection:', error);
      ScratchpadNotifications.error({
        title: 'Error updating column',
        message: error instanceof Error ? error.message : 'Failed to update column protection',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSetTitleColumn = async () => {
    try {
      setIsProcessing(true);
      setIsMenuOpen(false);

      if (!snapshot || !props.tableId) {
        ScratchpadNotifications.error({
          title: 'Error',
          message: 'Missing snapshot or table information',
        });
        return;
      }

      // Call the API to set the title column
      await snapshotApi.setTitleColumn(snapshot.id, props.tableId, columnId);

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

        {/* Column state icons */}
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: '4px', gap: '2px' }}>
          {isColumnHidden && (
            <span title="Column is hidden">
              <StyledLucideIcon Icon={EyeOff} size={12} c="#666" />
            </span>
          )}
          {isColumnProtected && (
            <span title="Column is protected">
              <StyledLucideIcon Icon={Lock} size={12} c="#666" />
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
                  <StyledLucideIcon Icon={Eye} size={14} c="#888" />
                ) : (
                  <StyledLucideIcon Icon={EyeOff} size={14} c="#888" />
                )}
                {isColumnHidden ? 'Unhide Column' : 'Hide Column'}
              </button>
              <button
                onClick={handleToggleColumnProtection}
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
                {isColumnProtected ? (
                  <StyledLucideIcon Icon={Square} size={14} c="#888" />
                ) : (
                  <StyledLucideIcon Icon={Lock} size={14} c="#888" />
                )}
                {isColumnProtected ? 'Unprotect Column' : 'Protect Column'}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
