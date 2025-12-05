import { AiAgentCredentialId } from './ids';

export type AgentService = 'openrouter';

export interface AgentCredential {
  id: AiAgentCredentialId;
  userId: string;
  service: AgentService;
  label: string;
  name: string;
  tokenUsageWarningLimit?: number;
  source: 'USER' | 'SYSTEM';
  createdAt: Date;
  updatedAt: Date;
  usage?: CreditUsage;
  default: boolean;
}

export interface CreditUsage {
  limit: number;
  limitRemaining: number;
  limitReset: string;
  usage: number;
  usageDaily: number;
  usageWeekly: number;
  usageMonthly: number;
  isFreeTier: boolean;
}
