///
/// NOTE: Keep this in sync with server/prisma/schema.prisma AuditLogEvent model
/// Begin "keep in sync" section
///

export interface AuditLogEvent {
  id: string;
  userId: string;
  organizationId: string | null;
  eventType: string;
  message: string;
  entityId: string;
  context: Record<string, unknown>;
  createdAt: Date;
}

///
/// End "keep in sync" section
///
