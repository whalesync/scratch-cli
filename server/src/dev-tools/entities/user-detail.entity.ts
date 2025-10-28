import { AuditLogEvent } from '@prisma/client';
import { AuditLogEventEntity } from 'src/audit/entities/audit-log-event.entity';
import { SnapshotCluster, UserCluster } from 'src/db/cluster-types';
import { ConnectorAccount } from 'src/remote-service/connector-account/entities/connector-account.entity';
import { User } from 'src/users/entities/user.entity';

export class SnapshotSummary {
  id: string;
  name: string;
  numTables: number;

  constructor(snapshot: SnapshotCluster.Snapshot) {
    this.id = snapshot.id;
    this.name = snapshot.name ?? 'Unnamed snapshot';
    this.numTables = snapshot.snapshotTables.length;
  }
}

export class ConnectorAccountSummary {
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
  snapshots: SnapshotSummary[];
  connectors: ConnectorAccountSummary[];
  auditLogs: AuditLogEventEntity[];

  constructor(
    user: UserCluster.User,
    snapshots: SnapshotCluster.Snapshot[],
    connectors: ConnectorAccount[],
    auditLogs: AuditLogEvent[],
  ) {
    this.user = new User(user);
    this.snapshots = snapshots.map((snapshot) => new SnapshotSummary(snapshot));
    this.connectors = connectors.map((connector) => new ConnectorAccountSummary(connector));
    this.auditLogs = auditLogs.map((auditLog) => new AuditLogEventEntity(auditLog));
  }
}
