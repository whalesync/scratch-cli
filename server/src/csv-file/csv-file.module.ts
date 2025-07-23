import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { CsvFileController } from './csv-file.controller';
import { CsvFileService } from './csv-file.service';

@Module({
  imports: [DbModule],
  controllers: [CsvFileController],
  providers: [CsvFileService],
  exports: [CsvFileService],
})
export class CsvFileModule {}
