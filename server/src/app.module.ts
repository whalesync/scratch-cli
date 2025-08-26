import { Module } from '@nestjs/common';
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
import { ConnectorAccountModule } from './remote-service/connector-account/connector-account.module';
import { ConnectorsModule } from './remote-service/connectors/connectors.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { StyleGuideModule } from './style-guide/style-guide.module';
import { UserModule } from './users/users.module';
import { ViewModule } from './view/view.module';

@Module({
  imports: [
    ScratchpadConfigModule,
    AdminModule,
    AgentJwtModule,
    DbModule,
    UserModule,
    ClerkModule,
    AuthModule,
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
