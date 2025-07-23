import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ClerkModule } from './clerk/clerk.module';
import { ScratchpadConfigModule } from './config/scratchpad-config.module';
import { RestApiImportModule } from './custom-connector-builder/custom-connector-builder.module';
import { DbModule } from './db/db.module';
import { CustomConnectorModule } from './generic-table/generic-table.module';
import { HealthModule } from './health/health.module';
import { ConnectorAccountModule } from './remote-service/connector-account/connector-account.module';
import { ConnectorsModule } from './remote-service/connectors/connectors.module';
import { SnapshotModule } from './snapshot/snapshot.module';
import { StyleGuideModule } from './style-guide/style-guide.module';
import { UserModule } from './users/users.module';
import { ViewModule } from './view/view.module';

@Module({
  imports: [
    ScratchpadConfigModule,
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
    ViewModule,
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
