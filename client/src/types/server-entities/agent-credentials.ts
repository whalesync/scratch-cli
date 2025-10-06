export type AgentService = 'openrouter';

export interface AiAgentCredential {
    id: string;
    userId: string;
    service: AgentService;
    label: string;
    description?: string;
    enabled: boolean;
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
    enabled: boolean;
    default?: boolean;
  }
  
  export interface UpdateAiAgentCredentialDto {
    description?: string;
    enabled?: boolean;
    default?: boolean;
  }

  export interface CreditUsage {
    limit: number;
    usage: number;
  }