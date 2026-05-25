import { Injectable } from '@nestjs/common';
import {
  AmqpConnection,
  MessageHandlerErrorBehavior,
  RabbitSubscribe,
} from '@golevelup/nestjs-rabbitmq';
import type { ConsumeMessage } from 'amqplib';
import { PinoLogger } from 'nestjs-pino';
import { AppConfigService } from '../../../../shared/config/app-config.service';
import { CORRELATION_ID_HEADER } from '../../../../shared/infra/http/correlation-id.constants';
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

/**
 * Topology owned by this consumer (declared via @RabbitSubscribe):
 *   - exchange `catalog.events` (topic) — already declared in MessagingModule
 *   - queue `audit.events.q` bound with `catalog.#`, dead-letters to `catalog.events.dlx`
 *   - DLX `catalog.events.dlx` (topic, durable)
 *   - DLQ `audit.events.dlq` bound with `#`
 *
 * Retry policy: the consumer republishes the message to its own queue with an
 * incremented `x-attempts` header up to {@link AUDIT_MAX_ATTEMPTS}; on the Nth
 * failure the original message is left unacked and NACKed without requeue, so
 * the broker dead-letters it to {@link AUDIT_DLQ}. Idempotency is enforced
 * upstream by the inbox (processed_event table).
 */
@Injectable()
export class AuditConsumer {
  constructor(
    private readonly useCase: ProcessDomainEventUseCase,
    private readonly amqp: AmqpConnection,
    private readonly config: AppConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AuditConsumer.name);
  }

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
    if (!eventId) {
      this.logger.error({ headers }, 'message has no event id — sending to DLQ');
      throw new Error('missing_event_id');
    }

    const correlationId = (headers[CORRELATION_ID_HEADER] as string | undefined) ?? null;
    const attempts = ((headers[ATTEMPTS_HEADER] as number | undefined) ?? 0) + 1;

    const eventType = message.eventName ?? amqpMsg.fields.routingKey;
    const aggregateId = message.aggregateId;
    const occurredAt = this.parseOccurredAt(message.occurredAt);

    if (typeof eventType !== 'string' || typeof aggregateId !== 'string') {
      this.logger.error({ eventId, message }, 'malformed event payload — sending to DLQ');
      throw new Error('malformed_event');
    }

    const input: DomainEventMessage = {
      eventId,
      eventType,
      aggregateType: aggregateTypeFor(eventType),
      aggregateId,
      payload: message as Record<string, unknown>,
      correlationId,
      occurredAt,
    };

    try {
      await this.useCase.execute(input);
    } catch (err) {
      if (attempts >= AUDIT_MAX_ATTEMPTS) {
        this.logger.error(
          { err, eventId, attempts, correlationId },
          'audit consumer reached max attempts — message will go to DLQ',
        );
        throw err;
      }
      this.logger.warn(
        { err, eventId, attempts, correlationId },
        'audit consumer failed — re-queueing with incremented attempts header',
      );
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
