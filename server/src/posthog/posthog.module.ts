import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { PostHogService } from './posthog.service';

@Module({
  providers: [PostHogService],
  imports: [ScratchpadConfigModule],
  exports: [PostHogService], //export this service to use in other modules
  controllers: [],
})
export class PosthogModule {}
