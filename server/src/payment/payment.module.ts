import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { SlackNotificationModule } from 'src/slack/slack-notification.module';
import { StripePaymentController } from './payment.controller';
import { StripePaymentWebhookController } from './payment.webook.controller';
import { StripePaymentService } from './stripe-payment.service';

@Module({
  providers: [StripePaymentService],
  imports: [ScratchpadConfigModule, DbModule, PosthogModule, SlackNotificationModule],
  exports: [StripePaymentService], //export this service to use in other modules
  controllers: [StripePaymentController, StripePaymentWebhookController],
})
export class PaymentModule {}
