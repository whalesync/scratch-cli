import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { AgentSessionController } from './agent-session.controller';
import { AgentSessionService } from './agent-session.service';

@Module({
  imports: [DbModule],
  controllers: [AgentSessionController],
  providers: [AgentSessionService],
  exports: [AgentSessionService],
})
export class AgentSessionModule {}
