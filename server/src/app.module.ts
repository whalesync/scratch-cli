import { Module } from '@nestjs/common';
import { RestApiImportModule } from './api-import/api-import.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClerkModule } from './clerk/clerk.module';
import { ScratchpadConfigModule } from './config/scratchpad-config.module';
import { DbModule } from './db/db.module';
import { GenericTableModule } from './generic-table/generic-table.module';
import { RecordsGateway } from './records.gateway';
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
    GenericTableModule,
    StyleGuideModule,
    ViewModule,
  ],
  controllers: [AppController],
  providers: [AppService, RecordsGateway],
})
export class AppModule {}
