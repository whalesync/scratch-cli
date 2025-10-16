import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';

import { AgentJwtModule } from 'src/agent-jwt/agent-jwt.module';
import { AuditLogModule } from 'src/audit/audit-log.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { ExperimentsModule } from 'src/experiments/experiments.module';
import { OpenRouterModule } from 'src/openrouter/openrouter.module';
import { PaymentModule } from 'src/payment/payment.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { SlackNotificationModule } from 'src/slack/slack-notification.module';
import { AgentCredentialsController } from './agent-credentials.controller';
import { AgentCredentialsService } from './agent-credentials.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService, AgentCredentialsService],
  imports: [
    DbModule,
    AgentJwtModule,
    PosthogModule,
    ScratchpadConfigModule,
    ExperimentsModule,
    OpenRouterModule,
    PaymentModule,
    SlackNotificationModule,
    AuditLogModule,
  ],
  exports: [UsersService, AgentCredentialsService], //export this service to use in other modules
  controllers: [UsersController, AgentCredentialsController],
})
export class UserModule {}
