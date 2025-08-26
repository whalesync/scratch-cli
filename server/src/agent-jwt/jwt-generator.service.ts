import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ScratchpadConfigService } from 'src/config/scratchpad-config.service';
import { AgentJwtPayload } from './types';

@Injectable()
export class JwtGeneratorService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ScratchpadConfigService,
  ) {}

  generateToken(payload: AgentJwtPayload): string {
    const secret = this.configService.getScratchpadAgentJWTSecret();
    const expiresIn = this.configService.getScratchpadAgentJWTExpiresIn();

    return this.jwtService.sign(payload, { secret, expiresIn });
  }
}
