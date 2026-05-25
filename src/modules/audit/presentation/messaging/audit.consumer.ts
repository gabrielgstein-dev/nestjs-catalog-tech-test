import { Injectable } from '@nestjs/common';
import {
  AmqpConnection,
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from '@golevelup/nestjs-rabbitmq';
import type { ConsumeMessage } from 'amqplib';
import { AppConfigService } from '../../../../shared/config/app-config.service';
import { CORRELATION_ID_HEADER } from '../../../../shared/infra/http/correlation-id.constants';
import { BusinessActionLogger } from '../../../../shared/infra/logging/business-action.logger';
import {
  AUDIT_QUEUE,
  AUDIT_DLX,
  AUDIT_MAX_ATTEMPTS,
  CATALOG_EXCHANGE,
  CATALOG_TOPIC_BINDING,
} from '../../infra/messaging/audit-routing';
import { aggregateTypeFor } from '../../../../shared/infra/outbox/outbox-routing';
import {
  DomainEventMessage,
  ProcessDomainEventUseCase,
} from '../../application/process-domain-event.use-case';

const ATTEMPTS_HEADER = 'x-attempts';
const EVENT_ID_HEADER = 'x-event-id';

interface RawMessage {
  eventName?: string;
  aggregateId?: string;
  occurredAt?: string | Date;
  [k: string]: unknown;
}

@Injectable()
export class AuditConsumer {
  constructor(
    private readonly useCase: ProcessDomainEventUseCase,
    private readonly amqp: AmqpConnection,
    private readonly config: AppConfigService,
    private readonly log: BusinessActionLogger,
  ) {}

  @RabbitSubscribe({
    exchange: CATALOG_EXCHANGE,
    routingKey: CATALOG_TOPIC_BINDING,
    queue: AUDIT_QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': AUDIT_DLX,
      },
    },
    errorBehavior: MessageHandlerErrorBehavior.NACK,
  })
  async handle(message: RawMessage, amqpMsg: ConsumeMessage): Promise<void> {
    const props = amqpMsg.properties ?? ({} as ConsumeMessage['properties']);
    const headers = (props.headers ?? {}) as Record<string, unknown>;

    const eventId = (headers[EVENT_ID_HEADER] as string | undefined) ?? props.messageId;
    const correlationId = (headers[CORRELATION_ID_HEADER] as string | undefined) ?? null;

    if (!eventId) {
      this.log.forCorrelationId(correlationId).error({
        action: 'audit.event.dlq',
        reason: 'missing_event_id',
      });
      throw new Error('missing_event_id');
    }

    const attempts = ((headers[ATTEMPTS_HEADER] as number | undefined) ?? 0) + 1;

    const eventType = message.eventName ?? amqpMsg.fields.routingKey;
    const aggregateId = message.aggregateId;
    const occurredAt = this.parseOccurredAt(message.occurredAt);

    if (typeof eventType !== 'string' || typeof aggregateId !== 'string') {
      this.log.forCorrelationId(correlationId).error({
        action: 'audit.event.dlq',
        eventId,
        reason: 'malformed_event',
      });
      throw new Error('malformed_event');
    }

    const aggregateType = aggregateTypeFor(eventType);
    const scoped = this.log.forCorrelationId(correlationId);

    scoped.info({
      action: 'audit.event.received',
      eventId,
      eventType,
      aggregateType,
      aggregateId,
      attempts,
    });

    const input: DomainEventMessage = {
      eventId,
      eventType,
      aggregateType,
      aggregateId,
      payload: message as Record<string, unknown>,
      correlationId,
      occurredAt,
    };

    try {
      await this.useCase.execute(input);
    } catch (err) {
      if (attempts >= AUDIT_MAX_ATTEMPTS) {
        scoped.error({
          action: 'audit.event.dlq',
          eventId,
          eventType,
          aggregateType,
          aggregateId,
          attempts,
          reason: 'max_attempts_reached',
          err,
        });
        throw err;
      }
      scoped.failure({
        action: 'audit.event.retry_scheduled',
        eventId,
        eventType,
        aggregateType,
        aggregateId,
        attempts,
        reason: 'use_case_failed',
      });
      await this.amqp.publish(this.config.rabbitmq.exchange, eventType, message, {
        persistent: true,
        messageId: eventId,
        headers: {
          ...headers,
          [EVENT_ID_HEADER]: eventId,
          [ATTEMPTS_HEADER]: attempts,
          [CORRELATION_ID_HEADER]: correlationId,
        },
      });
    }
  }

  private parseOccurredAt(raw: unknown): Date {
    if (raw instanceof Date) return raw;
    if (typeof raw === 'string') {
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date();
  }
}
