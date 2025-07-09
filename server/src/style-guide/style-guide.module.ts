import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { StyleGuideController } from './style-guide.controller';
import { StyleGuideService } from './style-guide.service';

@Module({
  providers: [StyleGuideService],
  imports: [DbModule],
  exports: [StyleGuideService],
  controllers: [StyleGuideController],
})
export class StyleGuideModule {}
