export class Table {
  name: string;
  path: TablePath;
}

export type TablePath = string[];

export class TableList {
  tables: Table[];
}
