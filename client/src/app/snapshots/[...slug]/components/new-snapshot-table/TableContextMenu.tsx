import { ScratchpadNotifications } from '@/app/components/ScratchpadNotifications';
import { useSnapshotContext } from '@/app/snapshots/[...slug]/components/contexts/SnapshotContext';
import { useSnapshotTableRecords } from '@/hooks/use-snapshot-table-records';
import { snapshotApi } from '@/lib/api/snapshot';
import { SnapshotRecord } from '@/types/server-entities/snapshot';
import { FunnelIcon, FunnelXIcon, ListBulletsIcon, ListChecksIcon } from '@phosphor-icons/react';
import { GridApi } from 'ag-grid-community';
import React, { useEffect, useRef, useState } from 'react';

interface TableContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  gridApi: GridApi<SnapshotRecord> | null;
  tableColumns: Array<{ id: { wsId: string }; name: string }>;
  tableId: string;
}

export const TableContextMenu: React.FC<TableContextMenuProps> = ({
  isOpen,
  position,
  onClose,
  gridApi,
  tableColumns,
  tableId,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { snapshot, currentViewId, viewDataAsAgent } = useSnapshotContext();
  const { acceptCellValues, rejectCellValues, refreshRecords } = useSnapshotTableRecords({
    snapshotId: snapshot?.id ?? '',
    tableId: tableId,
    viewId: viewDataAsAgent && currentViewId ? currentViewId : undefined,
  });

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedNodes = gridApi?.getSelectedNodes() || [];
  const selectedRows = selectedNodes.map((node) => node.data).filter(Boolean) as SnapshotRecord[];

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
    const rowNode = gridApi.getRowNode(focusedCell.rowIndex.toString());
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
    if (selectedRows.length === 0) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Get all selected record IDs
      const selectedRecordIds = selectedRows.map((record) => record.id.wsId);

      // Create SQL WHERE clause to exclude selected records
      const recordIdsList = selectedRecordIds.map((id) => `'${id}'`).join(', ');
      const sqlWhereClause = `"wsId" NOT IN (${recordIdsList})`;

      await snapshotApi.setActiveRecordsFilter(snapshot?.id || '', tableId, sqlWhereClause);

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
    if (selectedRows.length === 0) return;

    try {
      setIsProcessing(true);
      onClose(); // Close menu immediately

      // Get all selected record IDs
      const selectedRecordIds = selectedRows.map((record) => record.id.wsId);

      // Create SQL WHERE clause to include only selected records
      const recordIdsList = selectedRecordIds.map((id) => `'${id}'`).join(', ');
      const sqlWhereClause = `"wsId" IN (${recordIdsList})`;

      await snapshotApi.setActiveRecordsFilter(snapshot?.id || '', tableId, sqlWhereClause);

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

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: position.y,
        left: position.x,
        backgroundColor: '#2d2d2d',
        border: '1px solid #444',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        zIndex: 10000,
        minWidth: '250px',
        maxWidth: '400px',
        padding: '8px 0',
        fontSize: '13px',
        color: '#ffffff',
      }}
    >
      {/* Row Actions */}
      {selectedRowsWithSuggestions.length > 0 && (
        <div style={{ padding: '4px 0' }}>
          <div style={{ padding: '4px 12px', color: '#888', fontSize: '11px', fontWeight: 'bold' }}>Row Actions</div>
          <div
            onClick={handleAcceptSelectedRows}
            style={{
              padding: '8px 12px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.5 : 1,
              backgroundColor: 'transparent',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ListChecksIcon size={16} color="#00aa00" />
            <span>
              Accept {totalSuggestionsForSelectedRows}{' '}
              {totalSuggestionsForSelectedRows === 1 ? 'suggestion' : 'suggestions'} in{' '}
              {selectedRowsWithSuggestions.length} {selectedRowsWithSuggestions.length === 1 ? 'record' : 'records'}
            </span>
          </div>
          <div
            onClick={handleRejectSelectedRows}
            style={{
              padding: '8px 12px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.5 : 1,
              backgroundColor: 'transparent',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ListBulletsIcon size={16} color="#ff0000" />
            <span>
              Reject {totalSuggestionsForSelectedRows}{' '}
              {totalSuggestionsForSelectedRows === 1 ? 'suggestion' : 'suggestions'} in{' '}
              {selectedRowsWithSuggestions.length} {selectedRowsWithSuggestions.length === 1 ? 'record' : 'records'}
            </span>
          </div>
        </div>
      )}

      {/* Cell-specific actions for single row selection with focused cell */}
      {selectedRows.length === 1 && focusedCellInfo && focusedCellInfo.hasSuggestion && (
        <div style={{ borderTop: '1px solid #444', padding: '4px 0' }}>
          <div style={{ padding: '4px 12px', color: '#888', fontSize: '11px', fontWeight: 'bold' }}>Cell Actions</div>
          <div
            onClick={handleAcceptCellSuggestion}
            style={{
              padding: '8px 12px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.5 : 1,
              backgroundColor: 'transparent',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ListChecksIcon size={16} color="#00aa00" />
            <span>Accept suggestion</span>
          </div>
          <div
            onClick={handleRejectCellSuggestion}
            style={{
              padding: '8px 12px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.5 : 1,
              backgroundColor: 'transparent',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ListBulletsIcon size={16} color="#ff0000" />
            <span>Reject suggestion</span>
          </div>
        </div>
      )}

      {/* Column Actions */}
      {selectedRows.length === 1 && focusedCellInfo && (
        <div style={{ borderTop: '1px solid #444', padding: '4px 0' }}>
          <div style={{ padding: '4px 12px', color: '#888', fontSize: '11px', fontWeight: 'bold' }}>Column Actions</div>
          <div
            onClick={handleAcceptColumn}
            style={{
              padding: '8px 12px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.5 : 1,
              backgroundColor: 'transparent',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ListChecksIcon size={16} color="#00aa00" />
            <span>Accept column &ldquo;{focusedCellInfo.fieldName}&rdquo;</span>
          </div>
          <div
            onClick={handleRejectColumn}
            style={{
              padding: '8px 12px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.5 : 1,
              backgroundColor: 'transparent',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <ListBulletsIcon size={16} color="#ff0000" />
            <span>Reject column &ldquo;{focusedCellInfo.fieldName}&rdquo;</span>
          </div>
        </div>
      )}

      {/* Filter Actions */}
      {selectedRows.length > 0 && (
        <div style={{ borderTop: '1px solid #444', padding: '4px 0' }}>
          <div style={{ padding: '4px 12px', color: '#888', fontSize: '11px', fontWeight: 'bold' }}>Filtering</div>
          <div
            onClick={handleFilterOutRecords}
            style={{
              padding: '8px 12px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.5 : 1,
              backgroundColor: 'transparent',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FunnelXIcon size={16} color="#888" />
            <span>Filter Out Records</span>
          </div>
          <div
            onClick={handleFilterInRecords}
            style={{
              padding: '8px 12px',
              cursor: isProcessing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: isProcessing ? 0.5 : 1,
              backgroundColor: 'transparent',
              transition: 'background-color 0.1s',
            }}
            onMouseEnter={(e) => {
              if (!isProcessing) {
                e.currentTarget.style.backgroundColor = '#3a3a3a';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <FunnelIcon size={16} color="#888" />
            <span>Filter In Records</span>
          </div>
        </div>
      )}

      {/* Show message when no suggestions available */}
      {selectedRows.length > 0 && selectedRowsWithSuggestions.length === 0 && (
        <div style={{ borderTop: '1px solid #444', padding: '4px 0' }}>
          <div
            style={{
              padding: '8px 12px',
              color: '#888',
              fontSize: '12px',
              fontStyle: 'italic',
            }}
          >
            No suggestions available for selected rows
          </div>
        </div>
      )}
    </div>
  );
};
