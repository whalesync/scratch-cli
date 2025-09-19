export type AgentService = 'openrouter';

export interface AiAgentCredential {
    id: string;
    userId: string;
    service: AgentService;
    label: string;
    description?: string;
    enabled: boolean;
    source: 'USER' | 'SYSTEM';
  }
  
  export interface CreateAiAgentCredentialDto {
    service: AgentService;
    apiKey: string;
    description?: string;
    enabled: boolean;
  }
  
  export interface UpdateAiAgentCredentialDto {
    description?: string;
    enabled?: boolean;
  }