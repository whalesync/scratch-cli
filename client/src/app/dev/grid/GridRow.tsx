import { FC } from 'react';

type GridRowProps = {
  rowIndex: number;
  rowId: string;
  rowClassName: string;
  cell0ClassName: string;
  cell1ClassName: string;
  idColumnWidth: number;
  nameColumnWidth: number;
  idValue: string;
  nameValue: string;
  onCellClick: (rowIndex: number, cellIndex: number) => void;
};

export const GridRow: FC<GridRowProps> = ({
  rowIndex,
  rowId,
  rowClassName,
  cell0ClassName,
  cell1ClassName,
  idColumnWidth,
  nameColumnWidth,
  idValue,
  nameValue,
  onCellClick,
}) => {
  return (
    <div
      role="row"
      data-row-index={rowIndex}
      data-row-id={rowId}
      tabIndex={0}
      className={`ag-row ag-row-no-focus ag-row-level-0 ag-row-position-absolute ag-row-even ag-row-first ${rowClassName}`}
      aria-rowindex={rowIndex + 2}
      aria-selected="false"
      style={{ transform: `translateY(${rowIndex * 36}px)`, height: '36px' }}
    >
      {/* First cell - ID */}
      <div
        role="gridcell"
        data-col-id="id"
        tabIndex={-1}
        className={`ag-cell ag-cell-not-inline-editing ag-cell-normal-height ag-cell-value ${cell0ClassName}`}
        aria-colindex={2}
        style={{ left: '0px', width: `${idColumnWidth}px`, cursor: 'pointer' }}
        onClick={() => onCellClick(rowIndex, 0)}
      >
        <div
          className="field-value-wrapper"
          style={{
            alignItems: 'center',
            overflow: 'hidden',
            textOverflow: 'clip',
            whiteSpace: 'nowrap',
            height: '100%',
            display: 'flex',
            padding: '0 12px',
          }}
        >
          <p className="mantine-focus-auto cell-text m_b6d8b162 mantine-Text-root">{idValue}</p>
        </div>
      </div>

      {/* Second cell - Name */}
      <div
        role="gridcell"
        data-col-id="name"
        tabIndex={-1}
        className={`ag-cell ag-cell-not-inline-editing ag-cell-normal-height ag-cell-value ${cell1ClassName}`}
        aria-colindex={3}
        style={{ left: `${idColumnWidth}px`, width: `${nameColumnWidth}px`, cursor: 'pointer' }}
        onClick={() => onCellClick(rowIndex, 1)}
      >
        <div
          className="field-value-wrapper"
          style={{
            alignItems: 'center',
            overflow: 'hidden',
            textOverflow: 'clip',
            whiteSpace: 'nowrap',
            height: '100%',
            display: 'flex',
            padding: '0 12px',
          }}
        >
          <p className="mantine-focus-auto cell-text m_b6d8b162 mantine-Text-root">{nameValue}</p>
        </div>
      </div>
    </div>
  );
};
