import { AiAgentCredential as PrismaAiAgentCredential } from '@prisma/client';

export class AiAgentCredential {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
  service: string;
  apiKey: string;
  description: string | null;

  constructor(credential: PrismaAiAgentCredential) {
    this.id = credential.id;
    this.createdAt = credential.createdAt;
    this.updatedAt = credential.updatedAt;
    this.userId = credential.userId ?? null;
    this.service = credential.service;
    this.apiKey = credential.apiKey;
    this.description = credential.description ?? null;
  }
}
