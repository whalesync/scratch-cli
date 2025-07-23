import { Module } from '@nestjs/common';

import { AiModule } from 'src/ai/ai.module';
import { RestApiImportController } from './custom-connector-builder.controller';
import { RestApiImportService } from './custom-connector-builder.service';

@Module({
  imports: [AiModule],
  controllers: [RestApiImportController],
  providers: [RestApiImportService],
  exports: [RestApiImportService],
})
export class RestApiImportModule {}
