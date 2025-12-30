import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { WorkbookDbService } from './workbook-db.service';

@Module({
  imports: [DbModule],
  providers: [WorkbookDbService],
  exports: [WorkbookDbService],
})
export class WorkbookDbModule {}
