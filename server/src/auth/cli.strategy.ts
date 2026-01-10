import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-custom';

/**
 * This strategy inspects the request for a User-Agent header and validates it matches "Scratch-cli/1.0".
 * This is a simple authentication mechanism for CLI requests.
 */
@Injectable()
export class CliStrategy extends PassportStrategy(Strategy, 'CLI_STRATEGY') {
  constructor() {
    super();
  }

  validate(req: Request): boolean {
    const userAgent = req.headers['user-agent'];

    if (!userAgent || userAgent !== 'Scratch-CLI/1.0') {
      throw new UnauthorizedException('Invalid User-Agent');
    }

    return true;
  }
}
