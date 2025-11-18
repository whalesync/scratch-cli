import { AgentSession as PrismaAgentSession } from '@prisma/client';

export class AgentSessionEntity implements PrismaAgentSession {
  id: string;
  userId: string;
  workbookId: string;
  data: any; // JSON data
  createdAt: Date;
  updatedAt: Date;
}
