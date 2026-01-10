import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Auth guard for protecting CLI endpoints by validating the User-Agent header.
 * This guard requires the User-Agent to be "Scratch-cli/1.0".
 */
@Injectable()
export class CliAuthGuard extends AuthGuard('CLI_STRATEGY') {}
