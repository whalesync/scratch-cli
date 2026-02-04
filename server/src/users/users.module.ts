import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';

import { AuditLogModule } from 'src/audit/audit-log.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { ExperimentsModule } from 'src/experiments/experiments.module';
import { PaymentModule } from 'src/payment/payment.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { SlackNotificationModule } from 'src/slack/slack-notification.module';
import { OnboardingService } from './onboarding.service';
import { OrganizationsService } from './organizations.service';
import { SubscriptionService } from './subscription.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService, SubscriptionService, OrganizationsService, OnboardingService],
  imports: [
    DbModule,
    PosthogModule,
    ScratchpadConfigModule,
    ExperimentsModule,
    PaymentModule,
    SlackNotificationModule,
    AuditLogModule,
  ],
  exports: [UsersService, SubscriptionService, OnboardingService], //export this service to use in other modules
  controllers: [UsersController],
})
export class UserModule {}
