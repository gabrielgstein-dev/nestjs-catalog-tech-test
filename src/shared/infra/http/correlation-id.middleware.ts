import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { CORRELATION_ID_HEADER, CORRELATION_ID_KEY } from './correlation-id.constants';

type CorrelatedRequest = Request & {
  id?: string;
  [CORRELATION_ID_KEY]?: string;
};

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const r = req as CorrelatedRequest;
    const headerVal = req.headers[CORRELATION_ID_HEADER];
    const fromHeader = Array.isArray(headerVal) ? headerVal[0] : headerVal;

    const correlationId = r.id ?? r[CORRELATION_ID_KEY] ?? fromHeader ?? randomUUID();

    req.headers[CORRELATION_ID_HEADER] = correlationId;
    r.id = correlationId;
    r[CORRELATION_ID_KEY] = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    next();
  }
}
