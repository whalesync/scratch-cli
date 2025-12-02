import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';

import { AgentCredentialsModule } from 'src/agent-credentials/agent-credentials.module';
import { AgentJwtModule } from 'src/agent-jwt/agent-jwt.module';
import { AuditLogModule } from 'src/audit/audit-log.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { ExperimentsModule } from 'src/experiments/experiments.module';
import { PaymentModule } from 'src/payment/payment.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { SlackNotificationModule } from 'src/slack/slack-notification.module';
import { OrganizationsService } from './organizations.service';
import { SubscriptionService } from './subscription.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService, SubscriptionService, OrganizationsService],
  imports: [
    DbModule,
    AgentJwtModule,
    PosthogModule,
    ScratchpadConfigModule,
    ExperimentsModule,
    PaymentModule,
    SlackNotificationModule,
    AuditLogModule,
    AgentCredentialsModule,
  ],
  exports: [UsersService, SubscriptionService], //export this service to use in other modules
  controllers: [UsersController],
})
export class UserModule {}
