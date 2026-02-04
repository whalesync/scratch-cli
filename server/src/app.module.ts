import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AuditLogModule } from './audit/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { BugReportModule } from './bug-report/bug-report.module';
import { ClerkModule } from './clerk/clerk.module';
import { CliModule } from './cli/cli.module';
import { CodeMigrationsModule } from './code-migrations/code-migrations.module';
import { ScratchpadConfigModule } from './config/scratchpad-config.module';
import { ScratchpadConfigService } from './config/scratchpad-config.service';
import { CronModule } from './cron/cron.module';
import { WebflowCustomActionsModule } from './custom-actions/webflow/webflow-custom-actions.module';
import { WixCustomActionsModule } from './custom-actions/wix/wix-custom-actions.module';
import { DbModule } from './db/db.module';
import { DevToolsModule } from './dev-tools/dev-tools.module';
import { ExperimentsModule } from './experiments/experiments.module';
import { HealthModule } from './health/health.module';
import { JobModule } from './job/job.module';
import { JsonBodyMiddleware, RawBodyMiddleware } from './middleware';
import { OAuthModule } from './oauth/oauth.module';
import { PaymentModule } from './payment/payment.module';
import { PosthogModule } from './posthog/posthog.module';
import { ConnectorAccountModule } from './remote-service/connector-account/connector-account.module';
import { ConnectorsModule } from './remote-service/connectors/connectors.module';
import { ScratchGitModule } from './scratch-git/scratch-git.module';
import { SlackNotificationModule } from './slack/slack-notification.module';
import { StyleGuideModule } from './style-guide/style-guide.module';
import { SyncModule } from './sync/sync.module';
import { UserModule } from './users/users.module';
import { WorkbookModule } from './workbook/workbook.module';
import { WorkerEnqueuerModule } from './worker-enqueuer/worker-enqueuer.module';
import { WorkerModule } from './worker/workers.module';

@Module({
  imports: [
    ScratchpadConfigModule, // Load first so static environment variables are available
    PosthogModule,
    AuditLogModule,
    ExperimentsModule,
    HealthModule,
    DbModule,
    UserModule,
    ClerkModule,
    AuthModule,
    CliModule,
    OAuthModule,
    ConnectorAccountModule,
    ConnectorsModule,
    WebflowCustomActionsModule,
    WixCustomActionsModule,
    WorkbookModule,
    ScratchGitModule,
    SyncModule,
    StyleGuideModule,
    PaymentModule,
    SlackNotificationModule,
    WorkerEnqueuerModule,
    CodeMigrationsModule,
    ...(ScratchpadConfigService.isTaskWorkerService() ? [WorkerModule, JobModule] : []),
    ...(ScratchpadConfigService.isCronService() ? [CronModule] : []),
    DevToolsModule,
    BugReportModule,
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
        // Import suggestions endpoint
        { path: '/workbook/*/tables/*/import-suggestions', method: RequestMethod.POST },
        // Payment webhook
        { path: '/payment/webhook', method: RequestMethod.POST },
        // CLI folder files upload (multipart/form-data)
        { path: '/cli/v1/folders/*/files', method: RequestMethod.PUT },
      )
      .forRoutes('*');
  }
}
