export type AgentService = 'openrouter';

export interface AiAgentCredential {
  id: string;
  userId: string;
  service: AgentService;
  label: string;
  description?: string;
  source: 'USER' | 'SYSTEM';
  createdAt: string;
  updatedAt: string;
  usage?: CreditUsage;
  default: boolean;
}

export interface CreateAiAgentCredentialDto {
  service: AgentService;
  apiKey: string;
  description?: string;
  default?: boolean;
}

export interface UpdateAiAgentCredentialDto {
  description?: string;
  default?: boolean;
}

export interface CreditUsage {
  limit: number;
  usage: number;
}
