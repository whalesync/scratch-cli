import { UserRole } from '@prisma/client';

export interface AgentJwtPayload {
  userId: string;
  role: UserRole;
}
