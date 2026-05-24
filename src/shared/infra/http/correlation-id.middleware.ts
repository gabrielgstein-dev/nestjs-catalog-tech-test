import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CORRELATION_ID_HEADER } from './correlation-id.constants';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req as Request & { id?: string }).id ?? (req.headers[CORRELATION_ID_HEADER] as string);
    if (correlationId) {
      res.setHeader(CORRELATION_ID_HEADER, correlationId);
    }
    next();
  }
}
