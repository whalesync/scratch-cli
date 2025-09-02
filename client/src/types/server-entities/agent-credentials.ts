export type AgentService = 'openrouter';

export interface AiAgentCredential {
    id: string;
    userId: string;
    service: AgentService;
    apiKey: string;
    description?: string;
    enabled: boolean;
  }
  
  export interface CreateAiAgentCredentialDto {
    service: AgentService;
    apiKey: string;
    description?: string;
    enabled: boolean;
  }
  
  export interface UpdateAiAgentCredentialDto {
    apiKey?: string;
    description?: string;
    enabled?: boolean;
  }