import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ClerkModule } from 'src/clerk/clerk.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { UserModule } from 'src/users/users.module';
import { AgentTokenStrategy } from './agent-token.strategy';
import { APITokenStrategy } from './api-token.strategy';
import { ClerkStrategy } from './clerk.strategy';
import { CliAuthGuard } from './cli-auth.guard';
import { CliStrategy } from './cli.strategy';
import { WebSocketAuthGuard } from './websocket-auth-guard';

@Module({
  imports: [PassportModule, ScratchpadConfigModule, ClerkModule, DbModule, UserModule],
  providers: [ClerkStrategy, APITokenStrategy, WebSocketAuthGuard, AgentTokenStrategy, CliStrategy, CliAuthGuard],
  exports: [PassportModule, CliAuthGuard],
})
export class AuthModule {}
