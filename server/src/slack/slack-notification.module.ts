import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { SlackNotificationService } from './slack-notification.service';

@Module({
  imports: [ScratchpadConfigModule],
  providers: [SlackNotificationService],
  exports: [SlackNotificationService],
})
export class SlackNotificationModule {}
