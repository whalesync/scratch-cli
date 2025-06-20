import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RecordsGateway } from './records.gateway';
import { DbModule } from './db/db.module';
import { UserModule } from './user/user.module';
import { ScratchpadConfigModule } from './config/scratchpad-config.module';

@Module({
  imports: [ScratchpadConfigModule, DbModule, UserModule],
  controllers: [AppController],
  providers: [AppService, RecordsGateway],
})
export class AppModule {}
