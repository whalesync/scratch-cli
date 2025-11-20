import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Response } from 'express';
import { WSLogger } from 'src/logger';
import { ConnectorAuthError, ConnectorInstantiationError } from '../remote-service/connectors/error';

// NOTE: These ExceptionFilters need to be registered in either main.ts or through a module.

@Catch(ConnectorInstantiationError)
export class ConnectorInstantiationErrorExceptionFilter implements ExceptionFilter {
  catch(exception: ConnectorInstantiationError, host: ArgumentsHost): void {
    WSLogger.error({
      source: 'ExceptionFilters',
      message: `Caught ConnectorInstantiationError for ${exception.service}: ${exception.message}`,
      stack: exception.stack,
    });

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

@Catch(ConnectorAuthError)
export class ConnectorAuthErrorExceptionFilter implements ExceptionFilter {
  catch(exception: ConnectorAuthError, host: ArgumentsHost): void {
    WSLogger.error({
      source: 'ExceptionFilters',
      message: `Caught ConnectorAuthError for ${exception.service}: ${exception.message}`,
      stack: exception.stack,
    });

    // Convert this error into a BadRequestError with the userFriendlyMessage in the body
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const badRequestError = new BadRequestException(
      {
        message: exception.userFriendlyMessage,
        error: exception.message,
      },
      {
        cause: exception,
        description: exception.message,
      },
    );

    const status = badRequestError.getStatus();
    const errorResponse = badRequestError.getResponse();

    response.status(status).json(errorResponse);
  }
}
