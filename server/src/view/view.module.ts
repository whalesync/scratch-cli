import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';

@Module({
  imports: [DbModule],
  controllers: [ViewController],
  providers: [ViewService],
  exports: [ViewService],
})
export class ViewModule {}
