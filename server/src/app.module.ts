import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScratchpadConfigModule } from './config/scratchpad-config.module';
import { ConnectionsModule } from './connections/connections.module';
import { DbModule } from './db/db.module';
import { RecordsGateway } from './records.gateway';
import { UserModule } from './user/user.module';

@Module({
  imports: [ScratchpadConfigModule, DbModule, UserModule, ConnectionsModule],
  controllers: [AppController],
  providers: [AppService, RecordsGateway],
})
export class AppModule {}
