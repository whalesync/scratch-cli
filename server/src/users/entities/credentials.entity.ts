import { AiAgentCredential as PrismaAiAgentCredential } from '@prisma/client';
import { OpenRouterGetCurrentApiKeyData } from 'src/openrouter/types';

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
  default: boolean;

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
    this.default = credential.default;
  }
}

function obfuscateApiKey(apiKey: string): string {
  return apiKey.slice(0, 4) + '********' + apiKey.slice(-4);
}

export class CreditUsage {
  limit: number;
  limitRemaining: number;
  limitReset: string;
  usage: number;
  usageDaily: number;
  usageWeekly: number;
  usageMonthly: number;
  isFreeTier: boolean;

  constructor(args: OpenRouterGetCurrentApiKeyData) {
    this.limit = args.limit;
    this.usage = args.usage;
    this.limitRemaining = args.limit_remaining;
    this.limitReset = args.limit_reset;
    this.usageDaily = args.usage_daily;
    this.usageWeekly = args.usage_weekly;
    this.usageMonthly = args.usage_monthly;
    this.isFreeTier = args.is_free_tier;
  }
}
