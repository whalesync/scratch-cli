import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { WSLogger } from '../logger';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, headers } = request;

    const agent = headers['user-agent']?.includes('scratchpad-pydantic-ai-agent') ? 'Pydantic AI Agent' : undefined;

    // Log the incoming request
    WSLogger.debug({
      source: 'RequestLog',
      message: url,
      method,
      agent,
    });

    return next.handle().pipe(tap(() => {}));
  }
}
