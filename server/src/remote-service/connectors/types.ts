export type TableListing = {
  displayName: string;
  connectorPath: TablePath;
};

export type TablePath = string[];

export type TableSpec = {
  pgName: string;
  connectorPath: TablePath;
  columns: ColumnSpec[];
};

export type ColumnSpec = {
  pgName: string;
  connectorId: string;
  type: 'text' | 'number' | 'json';
};

export type ConnectorRecord = { id: string; [key: string]: unknown };
