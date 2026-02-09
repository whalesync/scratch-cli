import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScratchConfigService } from './scratch-config.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [ScratchConfigService],
  exports: [ScratchConfigService], //export this service to use in other modules
})
export class ScratchConfigModule {}
