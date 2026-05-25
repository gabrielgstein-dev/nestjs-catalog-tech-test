import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { AuditLogEntity } from '../infra/entities/audit-log.entity';
import { ProcessedEventEntity } from '../infra/entities/processed-event.entity';
import { AUDIT_CONSUMER_NAME } from '../infra/messaging/audit-routing';

export interface DomainEventMessage {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  correlationId: string | null;
  occurredAt: Date;
}

export interface ProcessDomainEventResult {
  recorded: boolean;
}

@Injectable()
export class ProcessDomainEventUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProcessDomainEventUseCase.name);
  }

  async execute(input: DomainEventMessage): Promise<ProcessDomainEventResult> {
    return this.dataSource.transaction(async (manager) => {
      // Inbox-style dedupe: insert the (event_id, consumer) marker first.
      // ON CONFLICT DO NOTHING ⇒ second delivery short-circuits without writing audit_log.
      const inserted = await manager.query(
        `INSERT INTO processed_event (event_id, consumer)
              VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [input.eventId, AUDIT_CONSUMER_NAME],
      );
      if (!Array.isArray(inserted) || inserted.length === 0) {
        this.logger.info(
          { eventId: input.eventId, correlationId: input.correlationId },
          'event already processed — skipping',
        );
        return { recorded: false };
      }

      // Raw INSERT keeps the jsonb payload as a plain object (TypeORM's
      // QueryDeepPartialEntity typing rejects Record<string, unknown>).
      await manager.query(
        `INSERT INTO audit_log
              (event_id, aggregate_type, aggregate_id, event_type, payload, correlation_id, occurred_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
        [
          input.eventId,
          input.aggregateType,
          input.aggregateId,
          input.eventType,
          JSON.stringify(input.payload),
          input.correlationId,
          input.occurredAt,
        ],
      );

      // AuditLogEntity/ProcessedEventEntity stay referenced so TypeORM autoloads them.
      void AuditLogEntity;
      void ProcessedEventEntity;

      this.logger.info(
        {
          eventId: input.eventId,
          eventType: input.eventType,
          aggregateId: input.aggregateId,
          correlationId: input.correlationId,
        },
        'audit_log row written',
      );
      return { recorded: true };
    });
  }
}
