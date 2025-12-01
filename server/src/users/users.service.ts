import { Injectable } from '@nestjs/common';
import { AiAgentCredentialSource, TokenType, UserRole } from '@prisma/client';
import { createAiAgentCredentialId, createApiTokenId, createOrganizationId, createUserId } from '@spinner/shared-types';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { UserCluster } from 'src/db/cluster-types';
import { WSLogger } from 'src/logger';
import { OpenRouterService } from 'src/openrouter/openrouter.service';
import { getFreePlan } from 'src/payment/plans';
import { StripePaymentService } from 'src/payment/stripe-payment.service';
import { PostHogService } from 'src/posthog/posthog.service';
import { SlackFormatters } from 'src/slack/slack-formatters';
import { SlackNotificationService } from 'src/slack/slack-notification.service';
import { isOk } from 'src/types/results';
import { DbService } from '../db/db.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { generateApiToken, generateTokenExpirationDate, generateWebsocketTokenExpirationDate } from './tokens';
import { UserSettings } from './types';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DbService,
    private readonly postHogService: PostHogService,
    private readonly scratchpadConfigService: ScratchpadConfigService,
    private readonly openRouterService: OpenRouterService,
    private readonly stripePaymentService: StripePaymentService,
    private readonly slackNotificationService: SlackNotificationService,
  ) {}

  public async findOne(id: string): Promise<UserCluster.User | null> {
    return this.db.client.user.findUnique({ where: { id }, include: UserCluster._validator.include });
  }

  public async findByClerkId(clerkId: string): Promise<UserCluster.User | null> {
    return this.db.client.user.findFirst({ where: { clerkId }, include: UserCluster._validator.include });
  }

  public async getUserFromAPIToken(apiToken: string): Promise<UserCluster.User | null> {
    return this.db.client.user.findFirst({
      where: {
        apiTokens: { some: { token: apiToken, expiresAt: { gt: new Date() } } },
      },
      include: UserCluster._validator.include,
    });
  }

  public async getOrCreateUserFromClerk(
    clerkUserId: string,
    name?: string,
    email?: string,
  ): Promise<UserCluster.User | null> {
    const user = await this.findByClerkId(clerkUserId);

    if (user) {
      // make sure the user has an api token
      if (user.apiTokens.length === 0) {
        const newToken = await this.db.client.aPIToken.create({
          data: {
            id: createApiTokenId(),
            userId: user.id,
            token: generateApiToken(),
            expiresAt: generateWebsocketTokenExpirationDate(),
            type: TokenType.WEBSOCKET,
          },
        });

        return {
          ...user,
          apiTokens: [...user.apiTokens, newToken],
        };
      }

      // make sure the user has a websocket token
      const existingWebsocketToken = user.apiTokens.find((token) => token.type === TokenType.WEBSOCKET);
      if (existingWebsocketToken) {
        // check expiry and if expired, update it
        if (existingWebsocketToken.expiresAt < new Date()) {
          const updatedToken = await this.db.client.aPIToken.update({
            where: { id: existingWebsocketToken.id },
            data: { expiresAt: generateWebsocketTokenExpirationDate() },
          });
          user.apiTokens = user.apiTokens.map((token) =>
            token.id === existingWebsocketToken.id ? updatedToken : token,
          );
        }
      } else {
        const newToken = await this.db.client.aPIToken.create({
          data: {
            id: createApiTokenId(),
            userId: user.id,
            token: generateApiToken(),
            expiresAt: generateWebsocketTokenExpirationDate(),
            type: TokenType.WEBSOCKET,
          },
        });
        user.apiTokens.push(newToken);
      }

      if ((name && name !== user.name) || (email && email !== user.email)) {
        await this.db.client.user.update({
          where: { id: user.id },
          data: { name, email },
        });
      }

      return user;
    }

    let newUser: UserCluster.User = await this.db.client.user.create({
      data: {
        id: createUserId(),
        clerkId: clerkUserId,
        updatedAt: new Date(),
        role: UserRole.USER,
        name,
        email,
        apiTokens: {
          create: {
            id: createApiTokenId(),
            token: generateApiToken(),
            expiresAt: generateTokenExpirationDate(),
            type: TokenType.WEBSOCKET,
          },
        },
        organization: {
          create: {
            id: createOrganizationId(),
            name: name ? `${name} Organization` : 'New Organization',
            clerkId: clerkUserId, // Note(chris): this should be Clerk's Organization ID, and will need to be fixed later when fully implement Clerk orgs
          },
        },
      },
      include: UserCluster._validator.include,
    });

    this.postHogService.identifyNewUser(newUser);

    // add any additional resources to the user like subscriptions and api keys
    newUser = await this.addNewUserResources(newUser);

    await this.slackNotificationService.sendMessage(SlackFormatters.newUserSignup(newUser));

    return newUser;
  }

  public async addNewUserResources(newUser: UserCluster.User): Promise<UserCluster.User> {
    const updatedUser = newUser;

    const freePlan = getFreePlan();

    if (this.scratchpadConfigService.getGenerateOpenRouterKeyForNewUsers()) {
      const result = await this.openRouterService.createKey({
        userId: newUser.id,
        limit: freePlan.features.creditLimit,
        limitReset: freePlan.features.creditReset,
      });

      if (isOk(result)) {
        await this.db.client.aiAgentCredential.create({
          data: {
            id: createAiAgentCredentialId(),
            userId: newUser.id,
            service: 'openrouter',
            apiKey: result.v.key,
            externalApiKeyId: result.v.hash,
            description: `Free OpenRouter API key for Scratch`,
            source: AiAgentCredentialSource.SYSTEM,
            default: true,
          },
        });
      } else {
        WSLogger.error({
          // just log the error for now
          source: UsersService.name,
          message: `Failed to create OpenRouter key for user ${newUser.id}`,
          errorMessage: result.error,
          error: result.cause,
        });
      }
    }
    return updatedUser;
  }

  public async search(query: string): Promise<UserCluster.User[]> {
    return this.db.client.user.findMany({
      where: {
        OR: [
          { id: { contains: query, mode: 'insensitive' } },
          { clerkId: { contains: query, mode: 'insensitive' } },
          { stripeCustomerId: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: UserCluster._validator.include,
    });
  }

  public async updateUserSettings(user: UserCluster.User, dto: UpdateSettingsDto): Promise<void> {
    const existingSettings = (user.settings ?? {}) as UserSettings;

    let updatedSettings = {
      ...existingSettings,
      ...dto.updates,
    };

    // filter out null values as those should remove the key from the settings object
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    updatedSettings = Object.fromEntries(Object.entries(updatedSettings).filter(([_, value]) => value !== null));

    await this.db.client.user.update({
      where: { id: user.id },
      data: { settings: updatedSettings },
    });
  }
}
