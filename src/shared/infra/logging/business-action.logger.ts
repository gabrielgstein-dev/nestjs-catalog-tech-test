import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { CorrelationContext } from '../../application/correlation-context';

export type BusinessActionOutcome = 'success' | 'failure';

export interface BusinessActionFields {
  action: string;
  aggregateType?: string;
  aggregateId?: string;
  productId?: string;
  categoryId?: string;
  eventId?: string;
  eventType?: string;
  attempts?: number;
  [extra: string]: unknown;
}

export interface BusinessActionFailure extends BusinessActionFields {
  reason: string;
}

export interface BusinessActionError extends BusinessActionFailure {
  err?: unknown;
}

@Injectable()
export class BusinessActionLogger {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext('BusinessAction');
  }

  success(fields: BusinessActionFields): void {
    this.logger.info(this.envelope(fields, 'success'), fields.action);
  }

  failure(fields: BusinessActionFailure): void {
    this.logger.warn(this.envelope(fields, 'failure'), fields.action);
  }

  error(fields: BusinessActionError): void {
    this.logger.error(this.envelope(fields, 'failure'), fields.action);
  }

  info(fields: BusinessActionFields): void {
    this.logger.info(this.envelope(fields, 'success'), fields.action);
  }

  forCorrelationId(correlationId: string | null): ScopedBusinessActionLogger {
    return new ScopedBusinessActionLogger(this.logger, correlationId);
  }

  private envelope(fields: BusinessActionFields, outcome: BusinessActionOutcome): object {
    const correlationId = CorrelationContext.get() ?? null;
    return { ...fields, outcome, correlationId };
  }
}

export class ScopedBusinessActionLogger {
  constructor(
    private readonly logger: PinoLogger,
    private readonly correlationId: string | null,
  ) {}

  success(fields: BusinessActionFields): void {
    this.logger.info(this.envelope(fields, 'success'), fields.action);
  }

  failure(fields: BusinessActionFailure): void {
    this.logger.warn(this.envelope(fields, 'failure'), fields.action);
  }

  error(fields: BusinessActionError): void {
    this.logger.error(this.envelope(fields, 'failure'), fields.action);
  }

  info(fields: BusinessActionFields): void {
    this.logger.info(this.envelope(fields, 'success'), fields.action);
  }

  private envelope(fields: BusinessActionFields, outcome: BusinessActionOutcome): object {
    return { ...fields, outcome, correlationId: this.correlationId };
  }
}
