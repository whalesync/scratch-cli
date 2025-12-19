import { ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { AiAgentCredential, AiAgentCredentialSource } from '@prisma/client';
import { AiAgentCredentialId, createAiAgentCredentialId } from '@spinner/shared-types';
import { AuditLogService } from 'src/audit/audit-log.service';
import { WSLogger } from 'src/logger';
import { OpenRouterService } from 'src/openrouter/openrouter.service';
import { Plan } from 'src/payment/plans';
import { isErr, isOk } from 'src/types/results';
import { canCreatePersonalAgentCredentials } from 'src/users/subscription-utils';
import { DbService } from '../db/db.service';
import { PostHogService } from '../posthog/posthog.service';
import { Actor } from '../users/types';

const SYSTEM_OPENROUTER_NAME = 'OpenRouter API key provided by Scratch';

export type AgentCredentialMetadata = Record<string, string | number | boolean | null>;

@Injectable()
export class AgentCredentialsService {
  constructor(
    private readonly db: DbService,
    private readonly posthogService: PostHogService,
    private readonly auditLogService: AuditLogService,
    private readonly openRouterService: OpenRouterService,
  ) {}

  public async findOne(id: string): Promise<AiAgentCredential | null> {
    return this.db.client.aiAgentCredential.findUnique({
      where: { id },
    });
  }

  public async findOneForUser(id: string, userId: string): Promise<AiAgentCredential | null> {
    return this.db.client.aiAgentCredential.findFirst({
      where: { id, userId },
    });
  }

  public async findSystemOpenRouterCredential(userId: string): Promise<AiAgentCredential | null> {
    const results = await this.db.client.aiAgentCredential.findMany({
      where: { userId, source: AiAgentCredentialSource.SYSTEM, service: 'openrouter' },
    });

    if (results.length === 0) {
      return null;
    }

    if (results.length > 1) {
      throw new InternalServerErrorException(
        `Unexpected error: Multiple system open router credentials found for user ${userId}`,
      );
    }

    return results[0];
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
    actor: Actor,
    service: string = 'openrouter',
  ): Promise<AiAgentCredential | null> {
    return this.db.client.aiAgentCredential.findFirst({
      where: { userId: actor.userId, default: true, service },
      orderBy: { createdAt: 'desc' },
    });
  }

  public async create(
    data: {
      service: string;
      apiKey: string;
      name?: string;
      default?: boolean;
      tokenUsageWarningLimit?: number | null;
      metadata?: AgentCredentialMetadata;
    },
    actor: Actor,
  ): Promise<AiAgentCredential> {
    if (!canCreatePersonalAgentCredentials(actor.subscriptionStatus)) {
      throw new ForbiddenException(
        `You are not allowed to create personal OpenRouter API keys at this subscription level. Please upgrade your subscription to create personal keys.`,
      );
    }

    const result = await this.db.client.$transaction(async (tx) => {
      if (data.default) {
        await tx.aiAgentCredential.updateMany({
          where: { userId: actor.userId },
          data: { default: false },
        });
      }
      return tx.aiAgentCredential.create({
        data: {
          id: createAiAgentCredentialId(),
          userId: actor.userId,
          service: data.service,
          apiKey: data.apiKey,
          name: data.name,
          default: data.default,
          tokenUsageWarningLimit: data.tokenUsageWarningLimit,
          metadata: data.metadata,
        },
      });
    });

    this.posthogService.trackCreateAgentCredential(actor.userId, result);

    await this.auditLogService.logEvent({
      actor,
      eventType: 'create',
      message: `Created new credential`,
      entityId: result.id as AiAgentCredentialId,
      context: {
        service: result.service,
        name: result.name,
      },
    });

    return result;
  }

  public async update(
    id: string,
    actor: Actor,
    data: {
      apiKey?: string;
      name?: string;
      tokenUsageWarningLimit?: number | null;
      default?: boolean;
      metadata?: AgentCredentialMetadata;
    },
  ): Promise<AiAgentCredential> {
    const credential = await this.findOneForUser(id, actor.userId);
    if (!credential) {
      throw new NotFoundException(`Credential not found for id ${id}`);
    }
    const existingMetadata = (credential.metadata ?? {}) as AgentCredentialMetadata;
    const updatedMetadata = {
      ...existingMetadata,
      ...data.metadata,
    };

    if (data.default) {
      await this.db.client.aiAgentCredential.updateMany({
        where: { userId: actor.userId },
        data: { default: false },
      });
    }

    const result = await this.db.client.$transaction(async (tx) => {
      if (data.default) {
        await tx.aiAgentCredential.updateMany({
          where: { userId: actor.userId },
          data: { default: false },
        });
      }

      return tx.aiAgentCredential.update({
        where: { id, userId: actor.userId },
        data: {
          apiKey: data.apiKey,
          name: data.name,
          tokenUsageWarningLimit: data.tokenUsageWarningLimit,
          default: data.default,
          metadata: updatedMetadata,
        },
      });
    });

    await this.auditLogService.logEvent({
      actor,
      eventType: 'update',
      message: `Updated credential`,
      entityId: id as AiAgentCredentialId,
      context: {
        changedFields: Object.keys(data),
      },
    });

    return result;
  }

  public async delete(id: string, actor: Actor): Promise<AiAgentCredential | null> {
    const credential = await this.db.client.aiAgentCredential.findFirst({
      where: { id, userId: actor.userId },
    });
    if (!credential) {
      return null;
    }

    await this.db.client.$transaction(async (tx) => {
      await tx.aiAgentCredential.delete({
        where: { id, userId: actor.userId },
      });

      if (credential.default) {
        // set the first non-default credential as the default
        const firstNonDefaultCredential = await tx.aiAgentCredential.findFirst({
          where: { userId: actor.userId },
          orderBy: { source: 'asc' }, // system credentials should be first
        });
        if (firstNonDefaultCredential) {
          await tx.aiAgentCredential.update({
            where: { id: firstNonDefaultCredential.id },
            data: { default: true },
          });
        }
      }
    });

    if (credential.source === 'SYSTEM' && credential.service === 'openrouter' && credential.externalApiKeyId) {
      // attempt to delete the api key from OpenRouter
      const result = await this.openRouterService.deleteApiKey(credential.apiKey, credential.externalApiKeyId);
      if (isErr(result)) {
        WSLogger.error({
          source: AgentCredentialsService.name,
          message: `Failed to delete OpenRouter key for ${credential.id}`,
          error: result.error,
        });
      }
    }

    this.posthogService.trackDeleteAgentCredential(actor.userId, credential);

    await this.auditLogService.logEvent({
      actor,
      eventType: 'delete',
      message: `Deleted credential`,
      entityId: id as AiAgentCredentialId,
    });

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

  public async createSystemOpenRouterCredentialsForUser(userId: string, plan: Plan): Promise<AiAgentCredential> {
    const result = await this.openRouterService.createKey({
      userId,
      limit: plan.features.creditLimit,
      limitReset: plan.features.creditReset,
    });

    if (isOk(result)) {
      return await this.db.client.aiAgentCredential.create({
        data: {
          id: createAiAgentCredentialId(),
          userId,
          service: 'openrouter',
          apiKey: result.v.key,
          externalApiKeyId: result.v.hash,
          name: SYSTEM_OPENROUTER_NAME,
          source: AiAgentCredentialSource.SYSTEM,
          default: true,
          metadata: {
            plan: plan.planType,
            creditLimit: plan.features.creditLimit,
            creditReset: plan.features.creditReset,
          },
        },
      });
    } else {
      throw new Error(`Failed to create OpenRouter key for user ${userId} for plan ${plan.displayName}`);
    }
  }

  public async updateSystemOpenRouterCredentialLimit(userId: string, plan: Plan): Promise<void> {
    const credential = await this.findSystemOpenRouterCredential(userId);
    if (!credential) {
      throw new NotFoundException(`System open router credential not found for user ${userId}`);
    }

    if (!credential.externalApiKeyId) {
      throw new InternalServerErrorException(`OpenRounter API key hash not found on credential ${credential.id}`);
    }

    const result = await this.openRouterService.updateApiKey(credential.externalApiKeyId, {
      limit: plan.features.creditLimit,
      limit_reset: plan.features.creditReset === 'never' ? undefined : plan.features.creditReset,
    });
    if (isErr(result)) {
      throw new InternalServerErrorException(`Failed to update OpenRouter key for user ${userId}: ${result.error}`);
    }

    const existingMetadata = (credential.metadata ?? {}) as AgentCredentialMetadata;

    const updatedMetadata = {
      ...existingMetadata,
      plan: plan.planType,
      creditLimit: plan.features.creditLimit,
      creditReset: plan.features.creditReset,
    };

    await this.db.client.aiAgentCredential.update({
      where: { id: credential.id },
      data: {
        name: SYSTEM_OPENROUTER_NAME,
        metadata: updatedMetadata,
      },
    });
  }

  public async disableSystemOpenRouterCredential(userId: string): Promise<void> {
    const credential = await this.findSystemOpenRouterCredential(userId);
    if (!credential) {
      throw new NotFoundException(`System open router credential not found for user ${userId}`);
    }
    if (!credential.externalApiKeyId) {
      throw new InternalServerErrorException(`OpenRounter API key hash not found on credential ${credential.id}`);
    }

    await this.openRouterService.disableApiKey(credential.externalApiKeyId);

    await this.db.client.aiAgentCredential.update({
      where: { id: credential.id },
      data: {
        name: `Deactivated - ${credential.name}`,
      },
    });
  }
}
