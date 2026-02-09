import { Module } from '@nestjs/common';
import { ScratchConfigModule } from 'src/config/scratch-config.module';
import { PostHogService } from './posthog.service';

@Module({
  providers: [PostHogService],
  imports: [ScratchConfigModule],
  exports: [PostHogService], //export this service to use in other modules
  controllers: [],
})
export class PosthogModule {}
