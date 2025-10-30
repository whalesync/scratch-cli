import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AgentJwtModule } from './agent-jwt/agent-jwt.module';
import { AgentSessionModule } from './agent-session/agent-session.module';
import { AiAgentTokenUsageModule } from './ai-agent-token-usage/ai-agent-token-usage.module';
import { AuditLogModule } from './audit/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { ClerkModule } from './clerk/clerk.module';
import { ScratchpadConfigModule } from './config/scratchpad-config.module';
import { ScratchpadConfigService } from './config/scratchpad-config.service';
import { CronModule } from './cron/cron.module';
import { CsvFileModule } from './csv-file/csv-file.module';
import { RestApiImportModule } from './custom-connector-builder/custom-connector-builder.module';
import { CustomConnectorModule } from './custom-connector/custom-connector.module';
import { DbModule } from './db/db.module';
import { DevToolsModule } from './dev-tools/dev-tools.module';
import { ExperimentsModule } from './experiments/experiments.module';
import { JobModule } from './job/job.module';
import { MentionsModule } from './mentions/mentions.module';
import { JsonBodyMiddleware, RawBodyMiddleware } from './middleware';
import { OAuthModule } from './oauth/oauth.module';
import { OpenRouterModule } from './openrouter/openrouter.module';
import { PaymentModule } from './payment/payment.module';
import { PosthogModule } from './posthog/posthog.module';
import { ConnectorAccountModule } from './remote-service/connector-account/connector-account.module';
import { ConnectorsModule } from './remote-service/connectors/connectors.module';
import { SlackNotificationModule } from './slack/slack-notification.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { StyleGuideModule } from './style-guide/style-guide.module';
import { UploadsModule } from './uploads/uploads.module';
import { UserModule } from './users/users.module';
import { ViewModule } from './view/view.module';
import { WorkerEnqueuerModule } from './worker-enqueuer/worker-enqueuer.module';
import { WorkerModule } from './worker/workers.module';

@Module({
  imports: [
    ScratchpadConfigModule, // Load first so static environment variables are available
    PosthogModule,
    AuditLogModule,
    ExperimentsModule,
    AdminModule,
    AgentJwtModule,
    AgentSessionModule,
    DbModule,
    UserModule,
    ClerkModule,
    AuthModule,
    OAuthModule,
    ConnectorAccountModule,
    ConnectorsModule,
    SnapshotModule,
    RestApiImportModule,
    CustomConnectorModule,
    StyleGuideModule,
    CsvFileModule,
    UploadsModule,
    ViewModule,
    AiAgentTokenUsageModule,
    PaymentModule,
    OpenRouterModule,
    SlackNotificationModule,
    MentionsModule,
    WorkerEnqueuerModule,
    ...(ScratchpadConfigService.isTaskWorkerService() ? [WorkerModule, JobModule] : []),
    ...(ScratchpadConfigService.isCronService() ? [CronModule] : []),
    DevToolsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  public configure(consumer: MiddlewareConsumer): void {
    // Ported from Whalesync's app.module.ts
    // Needed to have control over how we parse requests. Technique borrowed from
    // https://stackoverflow.com/questions/54346465/access-raw-body-of-stripe-webhook-in-nest-js
    consumer
      // NOTE! Stripe webhooks require access to the unparsed body to check the signatures. Connector webhooks need the
      // raw body because we have no idea ahead of time what format the body will be in.
      .apply(RawBodyMiddleware)
      .forRoutes({
        path: '/payment/webhook',
        method: RequestMethod.POST,
      })
      .apply(JsonBodyMiddleware)
      .exclude(
        // Legacy snapshot CSV upload endpoints (deprecated)
        { path: '/uploads/preview-csv', method: RequestMethod.POST },
        { path: '/snapshot/import-csv', method: RequestMethod.POST },
        // New uploads endpoints
        { path: '/uploads/csv/preview', method: RequestMethod.POST },
        { path: '/uploads/csv', method: RequestMethod.POST },
        { path: '/uploads/md/preview', method: RequestMethod.POST },
        { path: '/uploads/md', method: RequestMethod.POST },
        // Import suggestions endpoint
        { path: '/snapshot/*/tables/*/import-suggestions', method: RequestMethod.POST },
        // Payment webhook
        { path: '/payment/webhook', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
