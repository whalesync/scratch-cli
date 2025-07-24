import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { CustomConnectorController } from './custom-connector.controller';
import { CustomConnectorService } from './custom-connector.service';

@Module({
  imports: [DbModule],
  controllers: [CustomConnectorController],
  providers: [CustomConnectorService],
  exports: [CustomConnectorService],
})
export class CustomConnectorModule {}
