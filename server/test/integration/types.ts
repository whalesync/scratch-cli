// TypeScript type definitions for integration test data structures.
// Defines interfaces for workbooks, tables, sessions, records, and agent credentials.
export interface Workbook {
  id: string;
  name: string;
  snapshotTables: Table[];
}

export interface Table {
  id: string;
  tableSpec: {
    name: string;
    id: {
      wsId: string;
      remoteId: string[];
    };
  };
}

export interface Session {
  id: string;
  name: string;
}

export interface TableRecord {
  id: {
    wsId: string;
    remoteId: string[];
  };
  fields: Record<string, string>;
  __edited_fields: Record<string, string>;
  __suggested_values: Record<string, string>;
}

export interface RecordsResponse {
  count: number;
  records: TableRecord[];
}

export interface AgentCredential {
  id: string;
  default: boolean;
  enabled: boolean;
  service: string;
}
