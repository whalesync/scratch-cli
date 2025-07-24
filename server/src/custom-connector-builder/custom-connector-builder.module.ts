import { Module } from '@nestjs/common';

import { AiModule } from 'src/ai/ai.module';
import { AuthModule } from 'src/auth/auth.module';
import { CustomConnectorModule } from 'src/custom-connector/custom-connector.module';
import { RestApiImportController } from './custom-connector-builder.controller';
import { RestApiImportService } from './custom-connector-builder.service';

@Module({
  imports: [AiModule, CustomConnectorModule, AuthModule],
  controllers: [RestApiImportController],
  providers: [RestApiImportService],
  exports: [RestApiImportService],
})
export class RestApiImportModule {}
