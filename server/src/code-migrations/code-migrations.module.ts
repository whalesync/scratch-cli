import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SnapshotDbService } from '../workbook/snapshot-db.service';
import { CodeMigrationsController } from './code-migrations.controller';

@Module({
  imports: [DbModule],
  controllers: [CodeMigrationsController],
  providers: [SnapshotDbService],
})
export class CodeMigrationsModule {}
