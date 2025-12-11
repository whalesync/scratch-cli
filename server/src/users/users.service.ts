import { Injectable } from '@nestjs/common';
import { TokenType, UserRole } from '@prisma/client';
import { createApiTokenId, createOrganizationId, createUserId } from '@spinner/shared-types';
import { AgentCredentialsService } from 'src/agent-credentials/agent-credentials.service';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { UserCluster } from 'src/db/cluster-types';
import { getFreePlan } from 'src/payment/plans';
import { PostHogService } from 'src/posthog/posthog.service';
import { SlackFormatters } from 'src/slack/slack-formatters';
import { SlackNotificationService } from 'src/slack/slack-notification.service';
import { DbService } from '../db/db.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { generateApiToken, generateTokenExpirationDate, generateWebsocketTokenExpirationDate } from './tokens';
import { DEFAULT_GETTING_STARTED_V1, UserOnboarding, UserSettings } from './types';

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DbService,
    private readonly postHogService: PostHogService,
    private readonly scratchpadConfigService: ScratchpadConfigService,
    private readonly agentCredentialsService: AgentCredentialsService,
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

    const defaultOnboarding: UserOnboarding = {
      gettingStartedV1: DEFAULT_GETTING_STARTED_V1,
    };

    const newUser: UserCluster.User = await this.db.client.user.create({
      data: {
        id: createUserId(),
        clerkId: clerkUserId,
        updatedAt: new Date(),
        role: UserRole.USER,
        name,
        email,
        onboarding: defaultOnboarding as object,
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

    // add the Free Plan OpenRouter credentials to the new user
    await this.agentCredentialsService.createSystemOpenRouterCredentialsForUser(newUser.id, getFreePlan());

    await this.slackNotificationService.sendMessage(SlackFormatters.newUserSignup(newUser));

    return newUser;
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
