import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { CliController } from './cli.controller';
import { CliService } from './cli.service';

@Module({
  imports: [ScratchpadConfigModule, AuthModule],
  controllers: [CliController],
  providers: [CliService],
  exports: [CliService],
})
export class CliModule {}
