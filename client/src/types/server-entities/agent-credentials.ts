export type AgentService = 'openrouter';

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
