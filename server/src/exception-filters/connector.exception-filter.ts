import { ArgumentsHost, Catch, ExceptionFilter, InternalServerErrorException } from '@nestjs/common';
import type { Response } from 'express';
import { ConnectorInstantiationError } from '../remote-service/connectors/error';

@Catch(ConnectorInstantiationError)
export class ConnectorInstantiationErrorExceptionFilter implements ExceptionFilter {
  catch(exception: ConnectorInstantiationError, host: ArgumentsHost): void {
    // Convert this error into a proper InternalServerErrorException so that the message is properly sent to the client instead of "Internal server error"
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const internalServerError = new InternalServerErrorException(exception.message, {
      cause: exception,
      description: `Unable to initialize the  ${exception.service} connector`,
    });

    const status = internalServerError.getStatus();
    const errorResponse = internalServerError.getResponse();

    response.status(status).json(errorResponse);
  }
}
