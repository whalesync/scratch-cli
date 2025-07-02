import { Module } from '@nestjs/common';

import { AiModule } from 'src/ai/ai.module';
import { RestApiImportController } from './api-import.controller';
import { RestApiImportService } from './api-import.service';

@Module({
  imports: [AiModule],
  controllers: [RestApiImportController],
  providers: [RestApiImportService],
  exports: [],
})
export class RestApiImportModule {}
