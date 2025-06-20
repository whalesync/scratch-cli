import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScratchpadConfigService } from './scratchpad-config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [ScratchpadConfigService],
  exports: [ScratchpadConfigService], //export this service to use in other modules
})
export class ScratchpadConfigModule {}
