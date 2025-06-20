import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ClerkModule } from 'src/clerk/clerk.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { APITokenStrategy } from './api-token.strategy';
import { ClerkStrategy } from './clerk.strategy';

@Module({
  imports: [PassportModule, ScratchpadConfigModule, ClerkModule, DbModule],
  providers: [ClerkStrategy, APITokenStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
