import { AuditLogEvent } from "./audit-logs";
import { ConnectorAccount } from "./connector-accounts";
import { Snapshot } from "./snapshot";
import { User } from "./users";

/**
 * An admin view of a user for display in the developer tools
 */
export interface UserDetails {
    user: User;
    snapshots: Snapshot[];
    connectors: ConnectorAccount[];
    auditLogs: AuditLogEvent[];
  }