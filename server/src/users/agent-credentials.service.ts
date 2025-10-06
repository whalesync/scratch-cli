import { Injectable } from '@nestjs/common';
import { AiAgentCredential } from '@prisma/client';
import { createAiAgentCredentialId } from 'src/types/ids';
import { DbService } from '../db/db.service';
import { PostHogService } from '../posthog/posthog.service';

@Injectable()
export class AgentCredentialsService {
  constructor(
    private readonly db: DbService,
    private readonly posthogService: PostHogService,
  ) {}

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

  /**
   * @deprecated - (Chris) Agent should not be using this anymore
   */
  public async findActiveServiceCredentials(
    userId: string,
    service: string = 'openrouter',
  ): Promise<AiAgentCredential | null> {
    return this.db.client.aiAgentCredential.findFirst({
      where: { userId, enabled: true, service },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async create(data: {
    userId: string;
    service: string;
    apiKey: string;
    description?: string;
    enabled: boolean;
    default?: boolean;
  }): Promise<AiAgentCredential> {
    return this.db.client.aiAgentCredential.create({
      data: {
        id: createAiAgentCredentialId(),
        userId: data.userId,
        service: data.service,
        apiKey: data.apiKey,
        description: data.description,
        enabled: data.enabled,
        default: data.default,
      },
    });
  }

  public async update(
    id: string,
    userId: string,
    data: { apiKey?: string; description?: string; enabled?: boolean },
  ): Promise<AiAgentCredential> {
    return this.db.client.aiAgentCredential.update({
      where: { id, userId },
      data,
    });
  }

  public async delete(id: string, userId: string): Promise<AiAgentCredential | null> {
    const credential = await this.db.client.aiAgentCredential.delete({
      where: { id, userId },
    });

    if (!credential) {
      return null;
    }

    this.posthogService.trackDeleteAgentCredential(userId, credential);

    return credential;
  }

  /**
   * Sets the default key for the user and ensures all other keys are not default
   * @param id - the id of the key to set as default
   * @param userId - the id of the user
   * @returns the updated key
   */
  public async setDefaultKey(id: string, userId: string): Promise<AiAgentCredential> {
    return this.db.client.$transaction(async (tx) => {
      // First, set all keys for this user to not default
      await tx.aiAgentCredential.updateMany({
        where: { userId },
        data: { default: false },
      });

      // Then set the specified key as default
      return tx.aiAgentCredential.update({
        where: { id, userId },
        data: { default: true },
      });
    });
  }
}
