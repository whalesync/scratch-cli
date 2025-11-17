import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { SnapshotDbService } from '../snapshot/snapshot-db.service';
import { CodeMigrationsController } from './code-migrations.controller';

@Module({
  imports: [DbModule],
  controllers: [CodeMigrationsController],
  providers: [SnapshotDbService],
})
export class CodeMigrationsModule {}
