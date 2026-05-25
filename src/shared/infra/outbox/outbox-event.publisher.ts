import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DomainEvent } from '../../domain/domain-event';
import { DomainEventPublisher } from '../../application/domain-event-publisher.port';
import { CorrelationContext } from '../../application/correlation-context';
import { TransactionContext } from '../../application/transaction-context';
import { OUTBOX_STATUS } from './outbox.entity';
import { aggregateTypeFor } from './outbox-routing';

@Injectable()
export class OutboxEventPublisher implements DomainEventPublisher {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(OutboxEventPublisher.name);
  }

  async publish(events: ReadonlyArray<DomainEvent>): Promise<void> {
    if (events.length === 0) {
      return;
    }

    const manager = TransactionContext.get();
    if (!manager) {
      throw new Error(
        'OutboxEventPublisher.publish requires an active UnitOfWork — ' +
          'wrap the command in unitOfWork.run() so the outbox row commits with the mutation.',
      );
    }

    const correlationId = CorrelationContext.get() ?? null;
    for (const event of events) {
      await manager.query(
        `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload, status, occurred_at, correlation_id)
              VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)`,
        [
          aggregateTypeFor(event.eventName),
          event.aggregateId,
          event.eventName,
          JSON.stringify(this.serialize(event)),
          OUTBOX_STATUS.PENDING,
          event.occurredAt,
          correlationId,
        ],
      );
    }

    this.logger.debug(
      {
        correlationId,
        count: events.length,
        types: events.map((e) => e.eventName),
      },
      'outbox rows enqueued',
    );
  }

  private serialize(event: DomainEvent): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(event)) {
      const v = (event as unknown as Record<string, unknown>)[key];
      out[key] = v instanceof Date ? v.toISOString() : v;
    }
    return out;
  }
}
