import { Module } from '@nestjs/common';
import { AgentCredentialsModule } from 'src/agent-credentials/agent-credentials.module';
import { AuditLogModule } from 'src/audit/audit-log.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { SlackNotificationModule } from 'src/slack/slack-notification.module';
import { StripePaymentController } from './payment.controller';
import { StripePaymentWebhookController } from './payment.webook.controller';
import { PaymentsPublicController } from './payments-public.controller';
import { StripePaymentService } from './stripe-payment.service';

@Module({
  providers: [StripePaymentService],
  imports: [
    ScratchpadConfigModule,
    DbModule,
    PosthogModule,
    SlackNotificationModule,
    AgentCredentialsModule,
    AuditLogModule,
  ],
  exports: [StripePaymentService], //export this service to use in other modules
  controllers: [StripePaymentController, StripePaymentWebhookController, PaymentsPublicController],
})
export class PaymentModule {}
