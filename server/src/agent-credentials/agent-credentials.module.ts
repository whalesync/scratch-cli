import { Module } from '@nestjs/common';
import { AgentJwtModule } from 'src/agent-jwt/agent-jwt.module';
import { AuditLogModule } from 'src/audit/audit-log.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { ExperimentsModule } from 'src/experiments/experiments.module';
import { OpenRouterModule } from 'src/openrouter/openrouter.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { DbModule } from '../db/db.module';
import { AgentCredentialsController } from './agent-credentials.controller';
import { AgentCredentialsService } from './agent-credentials.service';

@Module({
  providers: [AgentCredentialsService],
  imports: [
    DbModule,
    AgentJwtModule,
    PosthogModule,
    ScratchpadConfigModule,
    ExperimentsModule,
    OpenRouterModule,
    AuditLogModule,
  ],
  exports: [AgentCredentialsService],
  controllers: [AgentCredentialsController],
})
export class AgentCredentialsModule {}
