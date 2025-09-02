import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AiAgentCredential, StyleGuide, User } from '@prisma/client';
import { PostHog } from 'posthog-node';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { SnapshotCluster } from 'src/db/cluster-types';
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

  captureEvent(eventName: PostHogEventName, user: User | string, properties: PostHogEventProperties = {}): void {
    if (!this.postHog) {
      return;
    }

    const distinctId = typeof user === 'string' ? user : user.id;
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

  trackCreateSnapshot(userId: string, snapshot: SnapshotCluster.Snapshot): void {
    this.captureEvent(PostHogEventName.SNAPSHOT_CREATED, userId, {
      snapshotId: snapshot.id,
      connector: snapshot.connectorAccount.service,
      numTables: snapshot.tableSpecs.length,
    });
  }

  trackRemoveSnapshot(userId: string, snapshot: SnapshotCluster.Snapshot): void {
    this.captureEvent(PostHogEventName.SNAPSHOT_REMOVED, userId, {
      snapshotId: snapshot.id,
      connector: snapshot.connectorAccount.service,
      numTables: snapshot.tableSpecs.length,
    });
  }

  trackPublishSnapshot(userId: string, snapshot: SnapshotCluster.Snapshot): void {
    this.captureEvent(PostHogEventName.SNAPSHOT_PUBLISHED, userId, {
      snapshotId: snapshot.id,
      connector: snapshot.connectorAccount.service,
      numTables: snapshot.tableSpecs.length,
    });
  }

  trackCreateResource(userId: string, resource: StyleGuide): void {
    this.captureEvent(PostHogEventName.RESOURCE_CREATED, userId, {
      resourceId: resource.id,
      isExternal: !!resource.sourceUrl,
      resourceType: resource.contentType,
    });
  }

  trackRemoveResource(userId: string, resource: StyleGuide): void {
    this.captureEvent(PostHogEventName.RESOURCE_REMOVED, userId, {
      resourceId: resource.id,
      isExternal: !!resource.sourceUrl,
      resourceType: resource.contentType,
    });
  }

  trackCreateAgentCredential(userId: string, credential: AiAgentCredential): void {
    this.captureEvent(PostHogEventName.AGENT_CREDENTIAL_CREATED, userId, {
      credentialId: credential.id,
      credentialType: credential.service,
    });
  }

  trackDeleteAgentCredential(userId: string, credential: AiAgentCredential): void {
    this.captureEvent(PostHogEventName.AGENT_CREDENTIAL_DELETED, userId, {
      credentialId: credential.id,
      credentialType: credential.service,
    });
  }
}

export enum PostHogEventName {
  ACCOUNT_USER_CREATED = 'account_user_created',
  CONNECTOR_ACCOUNT_CREATED = 'connector_created',
  CONNECTOR_ACCOUNT_REMOVED = 'connector_deleted',
  SNAPSHOT_CREATED = 'snapshot_created',
  SNAPSHOT_REMOVED = 'snapshot_deleted',
  SNAPSHOT_PUBLISHED = 'snapshot_published',
  RESOURCE_CREATED = 'resource_created',
  RESOURCE_REMOVED = 'resource_deleted',
  AGENT_CREDENTIAL_CREATED = 'agent_credential_created',
  AGENT_CREDENTIAL_DELETED = 'agent_credential_deleted',
}
