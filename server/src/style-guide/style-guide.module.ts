import { Module } from '@nestjs/common';
import { AuditLogModule } from 'src/audit/audit-log.module';
import { DbModule } from '../db/db.module';
import { PosthogModule } from '../posthog/posthog.module';
import { StyleGuideController } from './style-guide.controller';
import { StyleGuideService } from './style-guide.service';

@Module({
  providers: [StyleGuideService],
  imports: [DbModule, PosthogModule, AuditLogModule],
  exports: [StyleGuideService],
  controllers: [StyleGuideController],
})
export class StyleGuideModule {}
