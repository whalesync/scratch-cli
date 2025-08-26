import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Controller auth guard for protecting an endpoint with JWT auth via Clerk or a custom Whalesync API token.
 *
 * Currently the guard has default behavior, delegating to the Strategies for detailed implemention. It will attempt to
 * use each strategy in the array until one succeeds or they all fail.
 *
 * If debugging the auth pipeline, add a handleRequest() method to inspect the request,
 * and call super.handleRequest() to pass through
 */
@Injectable()
export class ScratchpadAuthGuard extends AuthGuard(['API_TOKEN_STRATEGY', 'AGENT_TOKEN_STRATEGY', 'clerk']) {}
