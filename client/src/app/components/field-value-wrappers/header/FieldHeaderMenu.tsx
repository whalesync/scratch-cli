import { StyledLucideIcon } from '@/app/components/Icons/StyledLucideIcon';
import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { workbookApi } from '@/lib/api/workbook';
import { ColumnSpec, SnapshotColumnSettingsMap, SnapshotRecord, Workbook } from '@/types/server-entities/workbook';
import { Menu } from '@mantine/core';
import { SnapshotTableId } from '@spinner/shared-types';
import _ from 'lodash';
import { CheckIcon, EyeOffIcon, MoreVertical, StarIcon, TrashIcon, XIcon } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { IconButtonInline } from '../../base/buttons';

interface HeaderMenuProps {
  isHovered: boolean;
  tableId?: SnapshotTableId;
  columnId: string;
  displayName: string;
  columnSpec?: ColumnSpec;
  records?: SnapshotRecord[];
  enableSorting?: boolean;
  currentSort: 'asc' | 'desc' | null;
  setSort: (sort: 'asc' | 'desc' | null) => void;

  // State from parent
  isColumnHidden: boolean;
  isScratchColumn: boolean;
  isTitleColumn: boolean;
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
  currentSort,
  setSort,
  isColumnHidden,
  isScratchColumn,
  isTitleColumn,
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
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if any record has suggestions for this column
  const recordsWithSuggestions = (records || []).filter((record) => {
    const suggestedValues = record.__suggested_values || {};
    return suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined;
  });
  const hasColumnSuggestions = recordsWithSuggestions.length > 0;

  const hasDataConverterTypes = columnSpec?.dataConverterTypes && columnSpec.dataConverterTypes.length > 0;

  const handleAcceptColumn = async () => {
    if (recordsWithSuggestions.length === 0) {
      ScratchpadNotifications.warning({
        title: 'Accept Column',
        message: `No suggestions found for column "${columnName}"`,
      });
      return;
    }

    try {
      setIsProcessing(true);

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
      return;
    }

    try {
      setIsProcessing(true);

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

  const dataConverterOptions = useMemo(() => {
    if (!hasDataConverterTypes || !columnSpec?.dataConverterTypes) {
      return [];
    }
    return [
      { value: '', label: 'Default' },
      ...columnSpec.dataConverterTypes.map((type) => ({ value: type, label: _.capitalize(type) })),
    ];
  }, [hasDataConverterTypes, columnSpec?.dataConverterTypes]);

  if (!(isHovered || isMenuOpen)) {
    return null;
  }

  return (
    <Menu opened={isMenuOpen} onChange={setIsMenuOpen} withinPortal>
      <Menu.Target>
        <IconButtonInline size="compact-xs" onClick={(e) => e.stopPropagation()}>
          <StyledLucideIcon Icon={MoreVertical} size={14} />
        </IconButtonInline>
      </Menu.Target>

      <Menu.Dropdown data-always-dark onClick={(e) => e.stopPropagation()}>
        {hasColumnSuggestions && (
          <>
            <Menu.Label>Changes</Menu.Label>
            <Menu.Item
              data-accept
              leftSection={<CheckIcon size={14} />}
              onClick={handleAcceptColumn}
              disabled={isProcessing}
            >
              Accept all changes in column
            </Menu.Item>
            <Menu.Item
              data-delete
              leftSection={<XIcon size={14} />}
              onClick={handleRejectColumn}
              disabled={isProcessing}
            >
              Reject all changes in column
            </Menu.Item>
            <Menu.Divider />
          </>
        )}

        {enableSorting && (
          <>
            <Menu.Label>Sorting</Menu.Label>
            <Menu.Item
              leftSection={currentSort === 'asc' ? <CheckIcon size={14} /> : undefined}
              onClick={() => setSort(currentSort === 'asc' ? null : 'asc')}
            >
              Sort ascending
            </Menu.Item>
            <Menu.Item
              leftSection={currentSort === 'desc' ? <CheckIcon size={14} /> : undefined}
              onClick={() => setSort(currentSort === 'desc' ? null : 'desc')}
            >
              Sort descending
            </Menu.Item>
            <Menu.Divider />
          </>
        )}

        <Menu.Label>Column</Menu.Label>
        <Menu.Item
          leftSection={<StarIcon size={14} fill={isTitleColumn ? 'currentColor' : 'none'} />}
          onClick={handleSetTitleColumn}
          disabled={isProcessing || isTitleColumn}
        >
          Use as title
        </Menu.Item>
        {!isColumnHidden && (
          <Menu.Item
            leftSection={<EyeOffIcon size={14} />}
            onClick={handleToggleColumnVisibility}
            disabled={isProcessing}
          >
            Hide column
          </Menu.Item>
        )}
        {isScratchColumn && (
          <Menu.Item
            data-delete
            leftSection={<StyledLucideIcon Icon={TrashIcon} size={14} />}
            onClick={handleRemoveScratchColumn}
            disabled={isProcessing}
            color="red"
          >
            Remove scratch column
          </Menu.Item>
        )}

        {hasDataConverterTypes && (
          <>
            <Menu.Divider />
            <Menu.Sub>
              <Menu.Sub.Target>
                <Menu.Sub.Item>Data format</Menu.Sub.Item>
              </Menu.Sub.Target>
              <Menu.Sub.Dropdown data-always-dark>
                {dataConverterOptions.map((option) => (
                  <Menu.Item
                    key={option.value}
                    leftSection={currentDataConverter === option.value ? <CheckIcon size={14} /> : undefined}
                    onClick={() => handleDataConverterChange(option.value)}
                  >
                    {option.label}
                  </Menu.Item>
                ))}
              </Menu.Sub.Dropdown>
            </Menu.Sub>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
};
