import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ScratchpadConfigModule } from 'src/config/scratchpad-config.module';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { JwtGeneratorService } from './jwt-generator.service';

@Module({
  imports: [
    ScratchpadConfigModule,
    JwtModule.registerAsync({
      imports: [ScratchpadConfigModule],
      global: true,
      useFactory: (configService: ScratchpadConfigService) => ({
        secret: configService.getScratchpadAgentJWTSecret(),
        signOptions: { expiresIn: configService.getScratchpadAgentJWTExpiresIn() },
      }),
      inject: [ScratchpadConfigService],
    }),
  ],
  providers: [JwtGeneratorService],
  exports: [JwtGeneratorService],
})
export class AgentJwtModule {}
