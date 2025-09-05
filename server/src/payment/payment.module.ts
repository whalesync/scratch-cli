import { Module } from '@nestjs/common';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { UserModule } from 'src/users/users.module';
import { StripePaymentController } from './payment.controller';
import { StripePaymentService } from './stripe-payment.service';

@Module({
  providers: [StripePaymentService],
  imports: [ScratchpadConfigModule, DbModule, UserModule, PosthogModule],
  exports: [StripePaymentService], //export this service to use in other modules
  controllers: [StripePaymentController],
})
export class PaymentModule {}
