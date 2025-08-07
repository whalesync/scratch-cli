export type AgentService = 'openai' | 'anthropic' | 'gemini';

export interface AiAgentCredential {
    id: string;
    userId: string;
    service: AgentService;
    apiKey: string;
    description?: string;
  }
  
  export interface CreateAiAgentCredentialDto {
    service: string;
    apiKey: string;
    description?: string;
  }
  
  export interface UpdateAiAgentCredentialDto {
    apiKey?: string;
    description?: string;
  }