import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AgentJwtModule } from './agent-jwt/agent-jwt.module';
import { AiAgentTokenUsageModule } from './ai-agent-token-usage/ai-agent-token-usage.module';
import { AuthModule } from './auth/auth.module';
import { ClerkModule } from './clerk/clerk.module';
import { ScratchpadConfigModule } from './config/scratchpad-config.module';
import { ContentToolsModule } from './content-tools/content-tools.module';
import { CsvFileModule } from './csv-file/csv-file.module';
import { RestApiImportModule } from './custom-connector-builder/custom-connector-builder.module';
import { CustomConnectorModule } from './custom-connector/custom-connector.module';
import { DbModule } from './db/db.module';
import { JsonBodyMiddleware, RawBodyMiddleware } from './middleware';
import { OAuthModule } from './oauth/oauth.module';
import { PaymentModule } from './payment/payment.module';
import { PosthogModule } from './posthog/posthog.module';
import { ConnectorAccountModule } from './remote-service/connector-account/connector-account.module';
import { ConnectorsModule } from './remote-service/connectors/connectors.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { StyleGuideModule } from './style-guide/style-guide.module';
import { UserModule } from './users/users.module';
import { ViewModule } from './view/view.module';

@Module({
  imports: [
    ScratchpadConfigModule,
    PosthogModule,
    AdminModule,
    AgentJwtModule,
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
    ViewModule,
    AiAgentTokenUsageModule,
    ContentToolsModule,
    PaymentModule,
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
      .forRoutes('*');
  }
}
