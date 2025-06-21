import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ClerkModule } from './clerk/clerk.module';
import { ScratchpadConfigModule } from './config/scratchpad-config.module';
import { DbModule } from './db/db.module';
import { EditSessionModule } from './edit-session/edit-session.module';
import { RecordsGateway } from './records.gateway';
import { ConnectorAccountModule } from './remote-services/connector-account/connector-account.module';
import { ConnectorsModule } from './remote-services/connectors/connectors.module';
import { UserModule } from './users/users.module';

@Module({
  imports: [
    ScratchpadConfigModule,
    DbModule,
    UserModule,
    ClerkModule,
    AuthModule,
    ConnectorAccountModule,
    ConnectorsModule,
    EditSessionModule,
  ],
  controllers: [AppController],
  providers: [AppService, RecordsGateway],
})
export class AppModule {}
