export type TablePath = string[];

export interface Table {
  displayName: string;
  connectorPath: TablePath;
}

export interface TableList {
  tables: Table[];
}
