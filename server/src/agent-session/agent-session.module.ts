import { Module } from '@nestjs/common';
import { AgentSessionService } from './agent-session.service';
import { AgentSessionController } from './agent-session.controller';
import { DbModule } from '../db/db.module';

@Module({
  imports: [DbModule],
  controllers: [AgentSessionController],
  providers: [AgentSessionService],
  exports: [AgentSessionService],
})
export class AgentSessionModule {}
