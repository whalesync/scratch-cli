import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { User } from '@prisma/client';
import { PostHog } from 'posthog-node';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WSLogger } from 'src/logger';

type PostHogEventProperties = Record<string, unknown>;

@Injectable()
export class PostHogService implements OnModuleDestroy {
  private postHog: PostHog | undefined;

  constructor(private readonly configService: ScratchpadConfigService) {
    const apiKey = configService.getPostHogApiKey();
    const host = configService.getPostHogHost();
    if (apiKey && host) {
      this.postHog = new PostHog(apiKey, {
        host,
      });

      WSLogger.info({
        source: PostHogService.name,
        message: 'PostHog is enabled',
      });
    } else {
      WSLogger.warn({
        source: PostHogService.name,
        message: 'PostHog is not enabled',
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.postHog) {
      await this.postHog.shutdown();
    }
  }

  private mapEventProperties(properties: PostHogEventProperties): PostHogEventProperties {
    return properties;
  }

  captureEvent(eventName: PostHogEventName, user: User, properties: PostHogEventProperties = {}): void {
    if (!this.postHog) {
      return;
    }

    const distinctId = user.id;
    const mappedProperties = this.mapEventProperties(properties);

    try {
      this.postHog.capture({
        event: eventName,
        distinctId,
        properties: mappedProperties,
      });
    } catch (err) {
      WSLogger.warn({
        source: PostHogService.name,
        message: `Failed to capture event "${eventName}"`,
        error: err,
        properties: mappedProperties,
      });
    }
  }

  /**
   * Identifies a new user to Posthog on the backend once we have created the User record and obtained an ID to use
   * as the Posthog distinctId.
   *
   * @param user User that was created
   */
  public identifyNewUser(user: User): void {
    if (!this.postHog) {
      return;
    }

    const eventProperties = {
      email: user.email,
      name: user.name,
    };

    try {
      // First time we have seen this user so we need to identify them on Posthog
      this.postHog.identify({ distinctId: user.id, properties: eventProperties });

      // dedicated event for user creation
      this.captureEvent(PostHogEventName.ACCOUNT_USER_CREATED, user, {
        name: user.name,
        email: user.email,
        role: user.role,
      });
    } catch (err) {
      WSLogger.warn({
        source: PostHogService.name,
        message: `Failed to identify user`,
        error: err,
        id: user.id,
      });
    }
  }
}

export enum PostHogEventName {
  ACCOUNT_USER_CREATED = 'account_user_created',
}
