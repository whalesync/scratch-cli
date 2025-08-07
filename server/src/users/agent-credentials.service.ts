import { Injectable } from '@nestjs/common';
import { AiAgentCredential } from '@prisma/client';
import { createAiAgentCredentialId } from 'src/types/ids';
import { DbService } from '../db/db.service';

@Injectable()
export class AgentCredentialsService {
  constructor(private readonly db: DbService) {}

  public async findOne(id: string): Promise<AiAgentCredential | null> {
    return this.db.client.aiAgentCredential.findUnique({
      where: { id },
    });
  }

  public async findByUserId(userId: string): Promise<AiAgentCredential[]> {
    return this.db.client.aiAgentCredential.findMany({
      where: { userId },
    });
  }

  public async create(data: {
    userId: string;
    service: string;
    apiKey: string;
    description?: string;
  }): Promise<AiAgentCredential> {
    return this.db.client.aiAgentCredential.create({
      data: {
        id: createAiAgentCredentialId(),
        userId: data.userId,
        service: data.service,
        apiKey: data.apiKey,
        description: data.description,
      },
    });
  }

  public async update(
    id: string,
    userId: string,
    data: { apiKey?: string; description?: string },
  ): Promise<AiAgentCredential> {
    return this.db.client.aiAgentCredential.update({
      where: { id, userId },
      data,
    });
  }

  public async delete(id: string, userId: string): Promise<AiAgentCredential | null> {
    return this.db.client.aiAgentCredential.delete({
      where: { id, userId },
    });
  }
}
