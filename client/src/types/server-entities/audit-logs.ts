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
