import { AiAgentCredential as PrismaAiAgentCredential } from '@prisma/client';

export type AgentService = 'openai' | 'anthropic' | 'gemini';
export class AiAgentCredential {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
  service: AgentService;
  apiKey: string;
  description: string | null;
  enabled: boolean;

  constructor(credential: PrismaAiAgentCredential) {
    this.id = credential.id;
    this.createdAt = credential.createdAt;
    this.updatedAt = credential.updatedAt;
    this.userId = credential.userId ?? null;
    this.service = credential.service as AgentService;
    this.apiKey = credential.apiKey;
    this.description = credential.description ?? null;
    this.enabled = credential.enabled ?? false;
  }
}
