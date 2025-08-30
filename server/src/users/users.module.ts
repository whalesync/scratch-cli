import { Module } from '@nestjs/common';

import { DbModule } from '../db/db.module';

import { AgentJwtModule } from 'src/agent-jwt/agent-jwt.module';
import { PosthogModule } from 'src/posthog/posthog.module';
import { AgentCredentialsController } from './agent-credentials.controller';
import { AgentCredentialsService } from './agent-credentials.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService, AgentCredentialsService],
  imports: [DbModule, AgentJwtModule, PosthogModule],
  exports: [UsersService, AgentCredentialsService], //export this service to use in other modules
  controllers: [UsersController, AgentCredentialsController],
})
export class UserModule {}
