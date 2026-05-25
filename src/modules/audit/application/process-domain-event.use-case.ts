import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BusinessActionLogger } from '../../../shared/infra/logging/business-action.logger';
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
    private readonly log: BusinessActionLogger,
  ) {}

  async execute(input: DomainEventMessage): Promise<ProcessDomainEventResult> {
    const scoped = this.log.forCorrelationId(input.correlationId);
    return this.dataSource.transaction(async (manager) => {
      const inserted = await manager.query(
        `INSERT INTO processed_event (event_id, consumer)
              VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING event_id`,
        [input.eventId, AUDIT_CONSUMER_NAME],
      );
      if (!Array.isArray(inserted) || inserted.length === 0) {
        scoped.info({
          action: 'audit.event.duplicate_skipped',
          eventId: input.eventId,
          eventType: input.eventType,
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
        });
        return { recorded: false };
      }

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

      void AuditLogEntity;
      void ProcessedEventEntity;

      scoped.success({
        action: 'audit.event.persisted',
        eventId: input.eventId,
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
      });
      return { recorded: true };
    });
  }
}
