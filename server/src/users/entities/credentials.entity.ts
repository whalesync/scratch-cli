import { AiAgentCredential as PrismaAiAgentCredential } from '@prisma/client';

export type AgentService = 'openrouter';

export class AiAgentCredential {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
  service: AgentService;
  apiKey: string;
  label: string;
  description: string | null;
  source: 'USER' | 'SYSTEM';
  enabled: boolean;
  usage?: CreditUsage;

  constructor(credential: PrismaAiAgentCredential, includeApiKey: boolean = false, usage?: CreditUsage) {
    this.id = credential.id;
    this.createdAt = credential.createdAt;
    this.updatedAt = credential.updatedAt;
    this.userId = credential.userId ?? null;
    this.service = credential.service as AgentService;
    this.apiKey = includeApiKey ? credential.apiKey : '****************';
    this.label = obfuscateApiKey(credential.apiKey);
    this.description = credential.description ?? null;
    this.source = credential.source as 'USER' | 'SYSTEM';
    this.enabled = credential.enabled;
    this.usage = usage;
  }
}

function obfuscateApiKey(apiKey: string): string {
  return apiKey.slice(0, 4) + '********' + apiKey.slice(-4);
}

export class CreditUsage {
  limit: number;
  usage: number;

  constructor(limit: number, usage: number) {
    this.limit = limit;
    this.usage = usage;
  }
}
