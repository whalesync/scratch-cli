import { useAgentChatContext } from '@/contexts/agent-chat-context';
import { useCallback } from 'react';
import { useSnapshotTableGridContext } from './SnapshotTableGridProvider';
import { FAKE_LEFT_COLUMNS } from './utils/helpers';

export const useDrawCell = () => {
  const { readFocus, writeFocus } = useAgentChatContext();
  const { sortedRecords, table } = useSnapshotTableGridContext();

  const drawCell = useCallback(
    (args: { rect: { x: number; y: number; width: number; height: number }; ctx: CanvasRenderingContext2D; col: number; row: number }, defaultDraw: () => void) => {
      const { rect, ctx, col, row } = args;

      // Let the default renderer draw the text cell first
      defaultDraw();

      // Check if this cell is in read focus
      const record = sortedRecords?.[row];
      const isReadFocused =
        record &&
        readFocus.some(
          (focusedCell) =>
            focusedCell.recordWsId === record.id.wsId &&
            focusedCell.columnWsId === (col === 1 ? 'id' : table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId),
        );

      // Check if this cell is in write focus
      const isWriteFocused =
        record &&
        writeFocus.some(
          (focusedCell) =>
            focusedCell.recordWsId === record.id.wsId &&
            focusedCell.columnWsId === (col === 1 ? 'id' : table.columns[col - FAKE_LEFT_COLUMNS]?.id.wsId),
        );

      // Add custom border for focused cells
      // Draw write focus first (thicker border, underneath)
      if (isWriteFocused) {
        ctx.strokeStyle = '#ff8c00'; // Orange for write focus
        ctx.lineWidth = 4; // Thicker border for write focus
        ctx.strokeRect(rect.x + 2, rect.y + 2, rect.width - 4, rect.height - 4);
      }

      // Draw read focus on top (thinner border, on top)
      if (isReadFocused) {
        ctx.strokeStyle = '#0066cc'; // Blue for read focus
        ctx.lineWidth = 2; // Thinner border for read focus
        ctx.strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
      }
    },
    [readFocus, writeFocus, sortedRecords, table],
  );

  return drawCell;
}; 