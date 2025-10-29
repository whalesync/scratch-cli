import { AuditLogEvent } from '@prisma/client';
import { AuditLogEventEntity } from 'src/audit/entities/audit-log-event.entity';
import { SnapshotCluster, UserCluster } from 'src/db/cluster-types';
import { ConnectorAccount } from 'src/remote-service/connector-account/entities/connector-account.entity';
import { User } from 'src/users/entities/user.entity';

export class WorkbookSummary {
  id: string;
  name: string;
  numTables: number;

  constructor(snapshot: SnapshotCluster.Snapshot) {
    this.id = snapshot.id;
    this.name = snapshot.name ?? 'Unnamed snapshot';
    this.numTables = snapshot.snapshotTables.length;
  }
}

export class ConnectionSummary {
  id: string;
  name: string;
  service: string;

  constructor(connectorAccount: ConnectorAccount) {
    this.id = connectorAccount.id;
    this.name = connectorAccount.displayName;
    this.service = connectorAccount.service.toString();
  }
}

/**
 * An admin view of a user for display in the developer tools
 */
export class UserDetail {
  user: User;
  workbooks: WorkbookSummary[];
  connections: ConnectionSummary[];
  auditLogs: AuditLogEventEntity[];

  constructor(
    user: UserCluster.User,
    snapshots: SnapshotCluster.Snapshot[],
    connectors: ConnectorAccount[],
    auditLogs: AuditLogEvent[],
  ) {
    this.user = new User(user);
    this.workbooks = snapshots.map((workbook) => new WorkbookSummary(workbook));
    this.connections = connectors.map((connector) => new ConnectionSummary(connector));
    this.auditLogs = auditLogs.map((auditLog) => new AuditLogEventEntity(auditLog));
  }
}
