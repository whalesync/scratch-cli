import { UserRole } from '@prisma/client';

export interface AgentJwtPayload {
  userId: string;
  role: UserRole;
  /**
   * List of allowed model IDs for the user's subscription.
   * Empty array means all models are allowed (paid plans).
   * Non-empty array restricts to only those specific models (free plan).
   */
  availableModels: string[];
}
