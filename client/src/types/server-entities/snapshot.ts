import { EntityId } from "./table-list";

export interface ColumnSpec {
  id: EntityId;
  type: "text" | "number" | "json";
}

export interface TableSpec {
  id: EntityId;
  name: string;
  columns: ColumnSpec[];
}

export interface Snapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  connectorAccountId: string;
  tables: TableSpec[];
}

export interface CreateSnapshotDto {
  connectorAccountId: string;
  tableIds: EntityId[];
}
