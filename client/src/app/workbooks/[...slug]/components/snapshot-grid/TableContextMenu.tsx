import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { ProcessedSnapshotRecord, useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { workbookApi } from '@/lib/api/workbook';
import { SnapshotRecord } from '@/types/server-entities/workbook';
import { Menu } from '@mantine/core';
import { SnapshotTableId } from '@spinner/shared-types';
import { GridApi } from 'ag-grid-community';
import { CheckIcon, FileText, Filter, FilterX, TrashIcon, Undo2, XIcon } from 'lucide-react';
import React, { useState } from 'react';
import { useActiveWorkbook } from '../../../../../hooks/use-active-workbook';
import { useWorkbookEditorUIStore } from '../../../../../stores/workbook-editor-store';
import { Service } from '../../../../../types/server-entities/connector-accounts';
import { PendingRecordUpdate, useUpdateRecordsContext } from '../contexts/update-records-context';
import { WebflowPublishMenuItem } from './custom-actions/webflow/WebflowPublishMenuItem';
import { WixPublishMenuItem } from './custom-actions/wix/WixPublishMenuItem';

interface TableContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  gridApi: GridApi<ProcessedSnapshotRecord> | null;
  tableColumns: Array<{ id: { wsId: string }; name: string }>;
  tableId: SnapshotTableId;
  onShowRecordJson?: (record: ProcessedSnapshotRecord) => void;
}

export const TableContextMenu: React.FC<TableContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  gridApi,
  tableColumns,
  tableId,
  onShowRecordJson,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { activeTable } = useActiveWorkbook();
  const { addPendingChange } = useUpdateRecordsContext();
  const workbookId = useWorkbookEditorUIStore((state) => state.workbookId);
  const { acceptCellValues, rejectCellValues, refreshRecords } = useSnapshotTableRecords({ workbookId, tableId });

  const selectedNodes = gridApi?.getSelectedNodes() || [];
  const selectedRows = selectedNodes.map((node) => node.data).filter(Boolean) as ProcessedSnapshotRecord[];

  // Find selected rows that have suggestions
  const selectedRowsWithSuggestions = selectedRows.filter((record) => {
    const suggestedValues = record.__suggested_values || {};
    return Object.keys(suggestedValues).some(
      (columnId) => suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined,
    );
  });

  // Count total suggestions for selected rows
  const totalSuggestionsForSelectedRows = selectedRowsWithSuggestions.reduce((total, record) => {
    const suggestedValues = record.__suggested_values || {};
    const suggestionCount = Object.keys(suggestedValues).filter(
      (columnId) => suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined,
    ).length;
    return total + suggestionCount;
  }, 0);

  // Get focused cell information
  const focusedCell = gridApi?.getFocusedCell();

  let focusedCellInfo: {
    recordId: string;
    fieldId: string;
    fieldName: string;
    record: SnapshotRecord;
    hasSuggestion: boolean;
  } | null = null;

  if (focusedCell && gridApi) {
    const rowNode = gridApi.getDisplayedRowAtIndex(focusedCell.rowIndex);
    const record = rowNode?.data as SnapshotRecord;
    const column = tableColumns.find((col) => col.id.wsId === focusedCell.column.getColId());

    if (record && column) {
      const hasSuggestion = !!record.__suggested_values?.[column.id.wsId];
      focusedCellInfo = {
        recordId: record.id?.wsId || 'Unknown',
        fieldId: column.id.wsId,
        fieldName: column.name,
        record,
        hasSuggestion,
      };
    }
  }

  const handleAcceptSelectedRows = async () => {
    if (selectedRowsWithSuggestions.length === 0) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Create items array for all suggestions in selected rows
      const items: { wsId: string; columnId: string }[] = [];
      selectedRowsWithSuggestions.forEach((record) => {
        const suggestedValues = record.__suggested_values || {};
        Object.keys(suggestedValues).forEach((columnId) => {
          if (suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined) {
            items.push({ wsId: record.id.wsId, columnId });
          }
        });
      });

      await acceptCellValues(items);

      const recordText = selectedRowsWithSuggestions.length === 1 ? 'record' : 'records';
      const suggestionText = totalSuggestionsForSelectedRows === 1 ? 'suggestion' : 'suggestions';

      ScratchpadNotifications.success({
        title: 'Suggestions Accepted',
        message: `Accepted ${totalSuggestionsForSelectedRows} ${suggestionText} for ${selectedRowsWithSuggestions.length} ${recordText}`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error accepting suggestions:', error);
      ScratchpadNotifications.error({
        title: 'Error Accepting Suggestions',
        message: error instanceof Error ? error.message : 'Failed to accept suggestions for selected records',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectSelectedRows = async () => {
    if (selectedRowsWithSuggestions.length === 0) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Create items array for all suggestions in selected rows
      const items: { wsId: string; columnId: string }[] = [];
      selectedRowsWithSuggestions.forEach((record) => {
        const suggestedValues = record.__suggested_values || {};
        Object.keys(suggestedValues).forEach((columnId) => {
          if (suggestedValues[columnId] !== null && suggestedValues[columnId] !== undefined) {
            items.push({ wsId: record.id.wsId, columnId });
          }
        });
      });

      await rejectCellValues(items);

      const recordText = selectedRowsWithSuggestions.length === 1 ? 'record' : 'records';
      const suggestionText = totalSuggestionsForSelectedRows === 1 ? 'suggestion' : 'suggestions';

      ScratchpadNotifications.success({
        title: 'Suggestions Rejected',
        message: `Rejected ${totalSuggestionsForSelectedRows} ${suggestionText} for ${selectedRowsWithSuggestions.length} ${recordText}`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error rejecting suggestions:', error);
      ScratchpadNotifications.error({
        title: 'Error Rejecting Suggestions',
        message: error instanceof Error ? error.message : 'Failed to reject suggestions for selected records',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptCellSuggestion = async () => {
    if (!focusedCellInfo || !focusedCellInfo.hasSuggestion) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      const items = [{ wsId: focusedCellInfo.recordId, columnId: focusedCellInfo.fieldId }];
      await acceptCellValues(items);

      ScratchpadNotifications.success({
        title: 'Suggestion Accepted',
        message: `Accepted suggestion for ${focusedCellInfo.fieldName}`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error accepting cell suggestion:', error);
      ScratchpadNotifications.error({
        title: 'Error Accepting Suggestion',
        message: error instanceof Error ? error.message : 'Failed to accept suggestion for this cell',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectCellSuggestion = async () => {
    if (!focusedCellInfo || !focusedCellInfo.hasSuggestion) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      const items = [{ wsId: focusedCellInfo.recordId, columnId: focusedCellInfo.fieldId }];
      await rejectCellValues(items);

      ScratchpadNotifications.success({
        title: 'Suggestion Rejected',
        message: `Rejected suggestion for ${focusedCellInfo.fieldName}`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error rejecting cell suggestion:', error);
      ScratchpadNotifications.error({
        title: 'Error Rejecting Suggestion',
        message: error instanceof Error ? error.message : 'Failed to reject suggestion for this cell',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilterOutRecords = async () => {
    if (selectedRows.length === 0 || !workbookId) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Get all selected record IDs
      const selectedRecordIds = selectedRows.map((record) => record.id.wsId);

      // Create SQL WHERE clause to exclude selected records
      const recordIdsList = selectedRecordIds.map((id) => `'${id}'`).join(', ');
      const sqlWhereClause = `"wsId" NOT IN (${recordIdsList})`;

      await workbookApi.setActiveRecordsFilter(workbookId, tableId, sqlWhereClause);

      ScratchpadNotifications.success({
        title: 'Filter Updated',
        message: `Filtered out ${selectedRecordIds.length} record(s)`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error filtering out records:', error);
      ScratchpadNotifications.error({
        title: 'Error updating filter',
        message: error instanceof Error ? error.message : 'Failed to filter out records',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptColumn = async () => {
    if (!focusedCellInfo) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Get all records that have suggestions for this column
      const recordsWithColumnSuggestions = (gridApi?.getSelectedRows() || []).filter((record) => {
        const suggestedValues = record.__suggested_values || {};
        return (
          suggestedValues[focusedCellInfo.fieldId] !== null && suggestedValues[focusedCellInfo.fieldId] !== undefined
        );
      });

      if (recordsWithColumnSuggestions.length === 0) {
        ScratchpadNotifications.warning({
          title: 'No Suggestions',
          message: `No suggestions found for column "${focusedCellInfo.fieldName}"`,
        });
        return;
      }

      // Create items array for all suggestions in this column
      const items: { wsId: string; columnId: string }[] = recordsWithColumnSuggestions.map((record) => ({
        wsId: record.id.wsId,
        columnId: focusedCellInfo.fieldId,
      }));

      await acceptCellValues(items);

      ScratchpadNotifications.success({
        title: 'Column Accepted',
        message: `Accepted ${items.length} suggestions for column "${focusedCellInfo.fieldName}"`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error accepting column:', error);
      ScratchpadNotifications.error({
        title: 'Error Accepting Column',
        message: error instanceof Error ? error.message : 'Failed to accept column suggestions',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectColumn = async () => {
    if (!focusedCellInfo) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Get all records that have suggestions for this column
      const recordsWithColumnSuggestions = (gridApi?.getSelectedRows() || []).filter((record) => {
        const suggestedValues = record.__suggested_values || {};
        return (
          suggestedValues[focusedCellInfo.fieldId] !== null && suggestedValues[focusedCellInfo.fieldId] !== undefined
        );
      });

      if (recordsWithColumnSuggestions.length === 0) {
        ScratchpadNotifications.warning({
          title: 'No Suggestions',
          message: `No suggestions found for column "${focusedCellInfo.fieldName}"`,
        });
        return;
      }

      // Create items array for all suggestions in this column
      const items: { wsId: string; columnId: string }[] = recordsWithColumnSuggestions.map((record) => ({
        wsId: record.id.wsId,
        columnId: focusedCellInfo.fieldId,
      }));

      await rejectCellValues(items);

      ScratchpadNotifications.success({
        title: 'Column Rejected',
        message: `Rejected ${items.length} suggestions for column "${focusedCellInfo.fieldName}"`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error rejecting column:', error);
      ScratchpadNotifications.error({
        title: 'Error Rejecting Column',
        message: error instanceof Error ? error.message : 'Failed to reject column suggestions',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilterInRecords = async () => {
    if (selectedRows.length === 0 || !workbookId) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Get all selected record IDs
      const selectedRecordIds = selectedRows.map((record) => record.id.wsId);

      // Create SQL WHERE clause to include only selected records
      const recordIdsList = selectedRecordIds.map((id) => `'${id}'`).join(', ');
      const sqlWhereClause = `"wsId" IN (${recordIdsList})`;

      await workbookApi.setActiveRecordsFilter(workbookId, tableId, sqlWhereClause);

      ScratchpadNotifications.success({
        title: 'Filter Updated',
        message: `Created filter for ${selectedRecordIds.length} record(s)`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error filtering in records:', error);
      ScratchpadNotifications.error({
        title: 'Error updating filter',
        message: error instanceof Error ? error.message : 'Failed to filter in records',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleShowRecordJson = () => {
    if (selectedRows.length === 1 && onShowRecordJson) {
      onShowRecordJson(selectedRows[0]);
      onClose();
    }
  };

  const handleDeleteRecords = async () => {
    if (selectedRows.length === 0 || !workbookId) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Delete records via API call
      await workbookApi.bulkUpdateRecords(workbookId, tableId, {
        creates: [],
        updates: [],
        deletes: selectedRows.map((record) => ({
          op: 'delete',
          wsId: record.id.wsId,
        })),
        undeletes: [],
      });

      ScratchpadNotifications.success({
        title: 'Records Deleted',
        message: `Deleted ${selectedRows.length} ${selectedRows.length === 1 ? 'record' : 'records'}`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error deleting records:', error);
      ScratchpadNotifications.error({
        title: 'Error deleting records',
        message: error instanceof Error ? error.message : 'Failed to delete records',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUndeleteRecords = async () => {
    if (selectedRows.length === 0 || !workbookId) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Add in a batch to speed up the invalidation of the cache.
      addPendingChange(
        ...selectedRows.map(
          (record): PendingRecordUpdate => ({
            workbookId,
            tableId: tableId,
            operation: {
              op: 'undelete',
              wsId: record.id.wsId,
            },
          }),
        ),
      );

      ScratchpadNotifications.success({
        title: 'Records Restored',
        message: `Restored ${selectedRows.length} ${selectedRows.length === 1 ? 'record' : 'records'}`,
      });

      await refreshRecords();
    } catch (error) {
      console.error('Error restoring records:', error);
      ScratchpadNotifications.error({
        title: 'Error restoring records',
        message: error instanceof Error ? error.message : 'Failed to restore records',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderConnectorCustomActions = () => {
    // Get the current table to check connector type
    const currentTable = activeTable;

    if (selectedRows.length === 0 || !currentTable) return null;

    // Webflow-specific actions
    if (currentTable.connectorService === Service.WEBFLOW) {
      return (
        <>
          <Menu.Label>Webflow actions</Menu.Label>
          <WebflowPublishMenuItem
            selectedRows={selectedRows}
            currentTable={currentTable}
            isProcessing={isProcessing}
            onClose={onClose}
            setIsProcessing={setIsProcessing}
          />
        </>
      );
    }

    // Wix Blog-specific actions
    if (currentTable.connectorService === Service.WIX_BLOG) {
      return (
        <>
          <Menu.Label>Wix actions</Menu.Label>
          <WixPublishMenuItem
            selectedRows={selectedRows}
            currentTable={currentTable}
            isProcessing={isProcessing}
            onClose={onClose}
            setIsProcessing={setIsProcessing}
          />
        </>
      );
    }

    // Add more connector-custom actions here as needed

    return null;
  };

  if (!isOpen) return null;

  return (
    <Menu
      opened={isOpen}
      onChange={(opened) => {
        if (!opened) onClose();
      }}
      withinPortal
      shadow="md"
    >
      <Menu.Target>
        <div
          style={{ position: 'fixed', top: position.y, left: position.x, width: 0, height: 0, visibility: 'hidden' }}
        />
      </Menu.Target>

      <Menu.Dropdown data-always-dark onClick={(e) => e.stopPropagation()}>
        {/* Cell suggestion */}
        {selectedRows.length === 1 && focusedCellInfo && focusedCellInfo.hasSuggestion && (
          <>
            <Menu.Label>Cell changes</Menu.Label>
            <Menu.Item
              data-accept
              leftSection={<CheckIcon size={14} />}
              onClick={handleAcceptCellSuggestion}
              disabled={isProcessing}
            >
              Accept change in this cell
            </Menu.Item>
            <Menu.Item
              data-delete
              leftSection={<XIcon size={14} />}
              onClick={handleRejectCellSuggestion}
              disabled={isProcessing}
            >
              Reject change in this cell
            </Menu.Item>
            <Menu.Divider />
          </>
        )}

        {/* Row suggestions */}
        {selectedRows.length > 0 && selectedRowsWithSuggestions.length > 0 && (
          <>
            <Menu.Label>Row changes</Menu.Label>
            <Menu.Item
              data-accept
              leftSection={<CheckIcon size={14} />}
              onClick={handleAcceptSelectedRows}
              disabled={isProcessing}
            >
              Accept all changes in row
            </Menu.Item>
            <Menu.Item
              data-delete
              leftSection={<XIcon size={14} />}
              onClick={handleRejectSelectedRows}
              disabled={isProcessing}
            >
              Reject all changes in row
            </Menu.Item>
            <Menu.Divider />
          </>
        )}

        {/* Column Suggestions */}
        {/* TODO: Only show if there was a suggestion for this column. */}
        {selectedRows.length === 1 && focusedCellInfo && (
          <>
            <Menu.Label>Column changes</Menu.Label>
            <Menu.Item
              data-accept
              leftSection={<CheckIcon size={14} />}
              onClick={handleAcceptColumn}
              disabled={isProcessing}
            >
              Accept column &ldquo;{focusedCellInfo.fieldName}&rdquo;
            </Menu.Item>
            <Menu.Item
              data-delete
              leftSection={<XIcon size={14} />}
              onClick={handleRejectColumn}
              disabled={isProcessing}
            >
              Reject column &ldquo;{focusedCellInfo.fieldName}&rdquo;
            </Menu.Item>
            <Menu.Divider />
          </>
        )}

        {/* Filter actions */}
        <Menu.Label>Filter</Menu.Label>
        <Menu.Item leftSection={<FilterX size={14} />} onClick={handleFilterOutRecords} disabled={isProcessing}>
          {selectedRows.length === 1 ? 'Exclude this record' : 'Exclude these records'}
        </Menu.Item>
        <Menu.Item leftSection={<Filter size={14} />} onClick={handleFilterInRecords} disabled={isProcessing}>
          {selectedRows.length === 1 ? 'Show only this record' : 'Show only these records'}
        </Menu.Item>
        <Menu.Divider />

        {selectedRows.length === 1 && (
          <>
            <Menu.Label>Record actions</Menu.Label>
            {selectedRows[0].__edited_fields?.__deleted ? (
              <Menu.Item
                data-accept
                leftSection={<Undo2 size={14} />}
                onClick={handleUndeleteRecords}
                disabled={isProcessing}
              >
                Restore Record
              </Menu.Item>
            ) : (
              <Menu.Item
                data-delete
                leftSection={<TrashIcon size={14} />}
                onClick={handleDeleteRecords}
                disabled={isProcessing}
              >
                Delete Record
              </Menu.Item>
            )}
            {/* TODO: Is this a dev option? */}
            <Menu.Item leftSection={<FileText size={14} />} onClick={handleShowRecordJson}>
              View record as JSON
            </Menu.Item>
            <Menu.Divider />
          </>
        )}

        {/* Connector-custom actions */}
        {renderConnectorCustomActions()}
      </Menu.Dropdown>
    </Menu>
  );
};
