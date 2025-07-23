import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { CustomConnectorController } from './generic-table.controller';
import { CustomConnectorService } from './generic-table.service';

@Module({
  imports: [DbModule],
  controllers: [CustomConnectorController],
  providers: [CustomConnectorService],
  exports: [CustomConnectorService],
})
export class CustomConnectorModule {}
