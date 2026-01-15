import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { DbModule } from 'src/db/db.module';
import { ConnectorsModule } from 'src/remote-service/connectors/connectors.module';
import { CliAuthController } from './cli-auth.controller';
import { CliAuthService } from './cli-auth.service';
import { CliController } from './cli.controller';
import { CliService } from './cli.service';

@Module({
  imports: [ScratchpadConfigModule, AuthModule, ConnectorsModule, DbModule],
  controllers: [CliController, CliAuthController],
  providers: [CliService, CliAuthService],
  exports: [CliService, CliAuthService],
})
export class CliModule {}
