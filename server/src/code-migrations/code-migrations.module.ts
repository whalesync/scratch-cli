import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { CodeMigrationsController } from './code-migrations.controller';

@Module({
  imports: [DbModule],
  controllers: [CodeMigrationsController],
  providers: [],
})
export class CodeMigrationsModule {}
