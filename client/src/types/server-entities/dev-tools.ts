import { AuditLogEvent } from './audit-logs';
import { User } from './users';

/**
 * An admin view of a user for display in the developer tools
 */
export interface UserDetails {
  user: User;
  workbooks: WorkbookSummary[];
  connections: ConnectionSummary[];
  auditLogs: AuditLogEvent[];
}

export interface WorkbookSummary {
  id: string;
  name: string;
  numTables: number;
}

export interface ConnectionSummary {
  id: string;
  name: string;
  service: string;
}
