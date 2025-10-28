export interface AuditLogEvent {
  id: string;
  userId: string;
  eventType: string;
  message: string;
  entityId: string;
  context: Record<string, unknown>;
  createdAt: Date;
}