import { AiAgentTokenUsageEvent as PrismaAiAgentTokenUsageEvent } from '@prisma/client';
import { AgentUsageEvent, AiAgentCredentialId, AiAgentTokenUsageEventId } from '@spinner/shared-types';

export class AgentTokenUsageEventEntity implements AgentUsageEvent {
  id: AiAgentTokenUsageEventId;
  credentialId?: AiAgentCredentialId;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  model: string;
  requests: number;
  requestTokens: number;
  responseTokens: number;
  totalTokens: number;
  context?: Record<string, any>;

  constructor(aiAgentTokenUsageEvent: PrismaAiAgentTokenUsageEvent) {
    this.id = aiAgentTokenUsageEvent.id as AiAgentTokenUsageEventId;
    this.credentialId = aiAgentTokenUsageEvent.credentialId as AiAgentCredentialId | undefined;
    this.createdAt = aiAgentTokenUsageEvent.createdAt;
    this.updatedAt = aiAgentTokenUsageEvent.updatedAt;
    this.userId = aiAgentTokenUsageEvent.userId;
    this.model = aiAgentTokenUsageEvent.model;
    this.requests = aiAgentTokenUsageEvent.requests;
    this.requestTokens = aiAgentTokenUsageEvent.requestTokens;
    this.responseTokens = aiAgentTokenUsageEvent.responseTokens;
    this.totalTokens = aiAgentTokenUsageEvent.totalTokens;
    this.context = aiAgentTokenUsageEvent.context as Record<string, any> | undefined;
  }
}
