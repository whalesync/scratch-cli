import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AiAgentCredential, StyleGuide, User } from '@prisma/client';
import { ScratchPlanType } from '@spinner/shared-types';
import { PostHog } from 'posthog-node';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { WorkbookCluster } from 'src/db/cluster-types';
import { WSLogger } from 'src/logger';

type PostHogEventProperties = Record<string, unknown>;

@Injectable()
export class PostHogService implements OnModuleDestroy {
  private postHog: PostHog | undefined;

  constructor(private readonly configService: ScratchpadConfigService) {
    const apiKey = configService.getPostHogApiKey();
    const host = configService.getPostHogHost();

    if (apiKey && host && configService.isPosthogAnaltyicsEnabled()) {
      this.postHog = new PostHog(apiKey, {
        host,
      });

      WSLogger.info({
        source: PostHogService.name,
        message: 'PostHog Analytics are enabled',
      });
    } else {
      WSLogger.warn({
        source: PostHogService.name,
        message: 'PostHog Analytics are disabled',
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

  trackCreateWorkbook(userId: string, workbook: WorkbookCluster.Workbook): void {
    this.captureEvent(PostHogEventName.WORKBOOK_CREATED, userId, {
      workbookId: workbook.id,
      numTables: workbook.snapshotTables.length,
      connectors: workbook.snapshotTables.map((t) => t.connectorAccount?.service),
    });
  }

  trackRemoveWorkbook(userId: string, workbook: WorkbookCluster.Workbook): void {
    this.captureEvent(PostHogEventName.WORKBOOK_REMOVED, userId, {
      workbookId: workbook.id,
      numTables: workbook.snapshotTables.length,
      connectors: workbook.snapshotTables.map((t) => t.connectorAccount?.service),
    });
  }

  trackPublishWorkbook(userId: string, workbook: WorkbookCluster.Workbook): void {
    this.captureEvent(PostHogEventName.WORKBOOK_PUBLISHED, userId, {
      workbookId: workbook.id,
      numTables: workbook.snapshotTables.length,
      connectors: workbook.snapshotTables.map((t) => t.connectorAccount?.service),
    });
  }

  trackCreateResource(userId: string, resource: StyleGuide): void {
    this.captureEvent(PostHogEventName.RESOURCE_CREATED, userId, {
      resourceId: resource.id,
      organizationId: resource.organizationId,
      isExternal: !!resource.sourceUrl,
      resourceType: resource.contentType,
    });
  }

  trackRemoveResource(userId: string, resource: StyleGuide): void {
    this.captureEvent(PostHogEventName.RESOURCE_REMOVED, userId, {
      resourceId: resource.id,
      organizationId: resource.organizationId,
      isExternal: !!resource.sourceUrl,
      resourceType: resource.contentType,
    });
  }

  trackCreateAgentCredential(userId: string, credential: AiAgentCredential): void {
    this.captureEvent(PostHogEventName.AGENT_CREDENTIAL_CREATED, userId, {
      credentialId: credential.id,
      credentialType: credential.service,
      credentialSource: credential.source,
    });
  }

  trackDeleteAgentCredential(userId: string, credential: AiAgentCredential): void {
    this.captureEvent(PostHogEventName.AGENT_CREDENTIAL_DELETED, userId, {
      credentialId: credential.id,
      credentialType: credential.service,
      credentialSource: credential.source,
    });
  }

  trackTrialStarted(userId: string, planType: ScratchPlanType): void {
    this.captureEvent(PostHogEventName.TRIAL_STARTED, userId, {
      planType,
    });
  }

  trackSubscriptionCancelled(userId: string, planType: ScratchPlanType): void {
    this.captureEvent(PostHogEventName.SUBSCRIPTION_CANCELLED, userId, {
      planType,
    });
  }
}

export enum PostHogEventName {
  ACCOUNT_USER_CREATED = 'account_user_created',
  CONNECTOR_ACCOUNT_CREATED = 'connector_created',
  CONNECTOR_ACCOUNT_REMOVED = 'connector_deleted',
  CONNECTOR_ACCOUNT_REAUTHORIZED = 'connector_reauthorized',
  WORKBOOK_CREATED = 'workbook_created',
  WORKBOOK_REMOVED = 'workbook_deleted',
  WORKBOOK_PUBLISHED = 'workbook_published',
  RESOURCE_CREATED = 'resource_created',
  RESOURCE_REMOVED = 'resource_deleted',
  AGENT_CREDENTIAL_CREATED = 'agent_credential_created',
  AGENT_CREDENTIAL_DELETED = 'agent_credential_deleted',
  TRIAL_STARTED = 'trial_started',
  SUBSCRIPTION_CANCELLED = 'subscription_cancelled',
  CLI_TEST_CONNECTION = 'cli_test_connection',
  CLI_LIST_TABLES = 'cli_list_tables',
  CLI_LIST_WORKBOOKS = 'cli_list_workbooks',
  CLI_LIST_DATA_FOLDERS = 'cli_list_data_folders',
  CLI_DOWNLOAD = 'cli_download',
  CLI_DOWNLOAD_FOLDER = 'cli_download_folder',
  CLI_PULL = 'cli_pull',
  CLI_UPLOAD = 'cli_upload',
  CLI_VALIDATE_FILES = 'cli_validate_files',
  CLI_UPLOAD_FOLDER = 'cli_upload_folder',
}
