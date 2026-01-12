import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Strategy } from 'passport-custom';
import { CliConnectorCredentials } from './types';

/**
 * This strategy inspects the request for a User-Agent header and validates it matches "Scratch-cli/1.0".
 * It also parses the optional X-Scratch-Connector header for connector credentials.
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

    // Parse optional X-Scratch-Connector header
    const connectorHeader = req.headers['x-scratch-connector'];
    if (connectorHeader) {
      const headerValue = Array.isArray(connectorHeader) ? connectorHeader[0] : connectorHeader;
      try {
        const parsed: unknown = JSON.parse(headerValue);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new BadRequestException('X-Scratch-Connector header must contain a valid JSON object');
        }
        // Attach parsed credentials to the request object
        (req as Request & { connectorCredentials?: CliConnectorCredentials }).connectorCredentials =
          parsed as CliConnectorCredentials;
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException('X-Scratch-Connector header contains invalid JSON');
      }
    }

    return true;
  }
}
