import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainError } from '../../../domain/domain-error';
import { CorrelationContext } from '../../../application/correlation-context';
import { CORRELATION_ID_HEADER } from '../correlation-id.constants';
import { AppConfigService } from '../../../config/app-config.service';
import { domainErrorToHttpStatus } from '../domain-error-status';
import { ErrorResponse } from './error-response.contract';

const reasonPhrase = (status: number): string => {
  if (status === HttpStatus.NOT_FOUND) return 'Not Found';
  if (status === HttpStatus.CONFLICT) return 'Conflict';
  if (status === HttpStatus.BAD_REQUEST) return 'Bad Request';
  if (status === HttpStatus.UNPROCESSABLE_ENTITY) return 'Unprocessable Entity';
  if (status === HttpStatus.INTERNAL_SERVER_ERROR) return 'Internal Server Error';
  return HttpStatus[status] ?? 'Error';
};

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  constructor(@Optional() @Inject(AppConfigService) private readonly config?: AppConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const correlationId =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined) ?? CorrelationContext.get();

    const mapped = this.toErrorResponse(exception);

    const body: ErrorResponse = {
      ...mapped,
      correlationId,
      timestamp: new Date().toISOString(),
      path: req.originalUrl ?? req.url,
    };

    if (correlationId) {
      res.setHeader(CORRELATION_ID_HEADER, correlationId);
    }

    if (body.statusCode >= 500) {
      this.logger.error(
        { err: exception, correlationId, path: body.path },
        'unhandled error reached global filter',
      );
    }

    res.status(body.statusCode).json(body);
  }

  private toErrorResponse(
    exception: unknown,
  ): Pick<ErrorResponse, 'statusCode' | 'error' | 'message' | 'code'> {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const errorName = reasonPhrase(status);
      if (typeof raw === 'string') {
        return { statusCode: status, error: errorName, message: raw };
      }
      const obj = raw as Record<string, unknown>;
      const message =
        (obj.message as string | string[] | undefined) ?? exception.message ?? errorName;
      const error = (obj.error as string | undefined) ?? errorName;
      return { statusCode: status, error, message };
    }

    if (exception instanceof DomainError) {
      const status = domainErrorToHttpStatus(exception.code);
      return {
        statusCode: status,
        error: reasonPhrase(status),
        message: exception.message,
        code: exception.code,
      };
    }

    if (exception instanceof Error && exception.constructor === Error) {
      // Plain Error usually originates from value-object validation (e.g. ProductName.of).
      // Treat as 400 — the request could not be coerced into a valid VO.
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: exception.message,
      };
    }

    const isProd = this.config?.nodeEnv === 'production';
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: isProd
        ? 'Internal server error'
        : exception instanceof Error
          ? exception.message
          : 'Unknown error',
    };
  }
}
