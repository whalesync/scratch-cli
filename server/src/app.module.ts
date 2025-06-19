import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RecordsGateway } from './records.gateway';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, RecordsGateway],
})
export class AppModule {}
