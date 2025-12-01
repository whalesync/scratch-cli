import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { workbookApi } from '@/lib/api/workbook';
import { ColumnSpec, SnapshotColumnSettingsMap, SnapshotRecord, Workbook } from '@/types/server-entities/workbook';
import { Group, Radio } from '@mantine/core';
import { SnapshotTableId } from '@spinner/shared-types';
import { EyeIcon, EyeOffIcon, List, ListChecks, MoreVertical, Star, TrashIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import styles from './FieldHeaderMenu.module.css';
interface HeaderMenuProps {
  isHovered: boolean;
  tableId?: SnapshotTableId;
  columnId: string;
  displayName: string;
  columnSpec?: ColumnSpec;
  records?: SnapshotRecord[];
  enableSorting?: boolean;
  setSort: (sort: 'asc' | 'desc' | null) => void;

  // State from parent
  isColumnHidden: boolean;
  isScratchColumn: boolean;
  currentDataConverter: string;

  // Actions/Objects from hooks
  workbook: Workbook | null | undefined;
  updateColumnSettings: (tableId: SnapshotTableId, settings: SnapshotColumnSettingsMap) => Promise<void>;
  hideColumn: (tableId: SnapshotTableId, columnId: string) => Promise<void>;
  unhideColumn: (tableId: SnapshotTableId, columnId: string) => Promise<void>;
  acceptCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  rejectCellValues: (items: { wsId: string; columnId: string }[]) => Promise<void>;
  refreshRecords: () => Promise<void>;
}

export const HeaderMenu: React.FC<HeaderMenuProps> = ({
  isHovered,
  tableId,
  columnId,
  displayName: columnName,
  columnSpec,
  records,
  enableSorting,
  setSort,
  isColumnHidden,
  isScratchColumn,
  currentDataConverter,
  workbook,
  updateColumnSettings,
  hideColumn,
  unhideColumn,
  acceptCellValues,
  rejectCellValues,
  refreshRecords,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Check if any record has suggestions for this column
  const recordsWithSuggestions = (records || []).filter((record) => {
    const suggestedValues = record.__suggested_values || {};
    return suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined;
  });
  const hasColumnSuggestions = recordsWithSuggestions.length > 0;

  const hasDataConverterTypes = columnSpec?.dataConverterTypes && columnSpec.dataConverterTypes.length > 0;

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

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering header sort
    if (!isMenuOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 2,
        right: window.innerWidth - rect.right,
      });
    }
    setIsMenuOpen(!isMenuOpen);
  };

  const onSortChanged = () => {
    setSort('asc');
  };

  const onSortRemoved = () => {
    setSort(null);
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
    if (!workbook || !tableId) {
      return;
    }

    try {
      await updateColumnSettings(tableId, {
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
    if (!workbook || !tableId) {
      return;
    }

    const shouldHide = !isColumnHidden;

    try {
      setIsProcessing(true);
      setIsMenuOpen(false);
      if (shouldHide) {
        await hideColumn(tableId, columnId);
      } else {
        await unhideColumn(tableId, columnId);
      }

      ScratchpadNotifications.success({
        title: 'Column Visibility Changed',
        message: `Column "${columnName}" is now ${shouldHide ? 'hidden from ' : 'visible to '} the agent`,
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

      if (!workbook || !tableId) {
        ScratchpadNotifications.error({
          title: 'Error',
          message: 'Missing workbook or table information',
        });
        return;
      }

      // Call the API to set the title column
      await workbookApi.setTitleColumn(workbook.id, tableId, columnId);

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

      if (!workbook || !tableId) {
        ScratchpadNotifications.error({
          title: 'Error',
          message: 'Missing workbook or table information',
        });
        return;
      }

      await workbookApi.removeScratchColumn(workbook.id, tableId, {
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

  if (!(isHovered || isMenuOpen)) {
    return null;
  }

  return (
    <>
      <button ref={buttonRef} onClick={handleMenuClick} className={styles.menuButtonWrapper}>
        <StyledLucideIcon Icon={MoreVertical} size={14} />
      </button>

      {/* Dropdown menu - rendered outside the positioned container */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className={styles.dropdownMenu}
          style={{
            top: menuPosition.top,
            right: menuPosition.right,
            backgroundColor: '#2d2d2d', // Investigate why moving to a css class breaks it
          }}
        >
          {/* Sort options */}
          {enableSorting && (
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
                  {columnSpec?.dataConverterTypes?.map((type) => (
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
          <div style={{ padding: '4px 12px', color: '#888', fontSize: '11px', fontWeight: 'bold' }}>Column View</div>
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
    </>
  );
};
