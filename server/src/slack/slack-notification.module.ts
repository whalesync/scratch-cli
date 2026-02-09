import { Module } from '@nestjs/common';
import { ScratchConfigModule } from 'src/config/scratch-config.module';
import { SlackNotificationService } from './slack-notification.service';

@Module({
  imports: [ScratchConfigModule],
  providers: [SlackNotificationService],
  exports: [SlackNotificationService],
})
export class SlackNotificationModule {}
