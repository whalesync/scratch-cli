import { Module } from '@nestjs/common';

import { RestApiImportController } from './api-import.controller';
import { RestApiImportService } from './api-import.service';
import { AiModule } from 'src/ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [RestApiImportController],
  providers: [RestApiImportService],
  exports: [],
})
export class RestApiImportModule {}
