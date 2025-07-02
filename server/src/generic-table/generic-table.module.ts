import { Module } from '@nestjs/common';
import { DbModule } from 'src/db/db.module';
import { GenericTableController } from './generic-table.controller';
import { GenericTableService } from './generic-table.service';

@Module({
  imports: [DbModule],
  controllers: [GenericTableController],
  providers: [GenericTableService],
  exports: [GenericTableService],
})
export class GenericTableModule {}
