import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { SkeletonAckEntity } from '../../infra/entities/skeleton-ack.entity';
import { SKELETON_ROUTING_KEY } from '../../infra/messaging/skeleton-routing';
import { CORRELATION_ID_HEADER } from '../../../../shared/infra/http/correlation-id.constants';
import { BusinessActionLogger } from '../../../../shared/infra/logging/business-action.logger';

interface PingMessage {
  id: string;
  payload: string;
  correlationId: string;
}

interface AmqpMsg {
  properties?: {
    headers?: Record<string, unknown>;
  };
}

@Injectable()
export class SkeletonConsumer {
  constructor(
    @InjectRepository(SkeletonAckEntity)
    private readonly acks: Repository<SkeletonAckEntity>,
    private readonly log: BusinessActionLogger,
  ) {}

  @RabbitSubscribe({
    exchange: process.env.RABBITMQ_EXCHANGE ?? 'catalog.events',
    routingKey: SKELETON_ROUTING_KEY,
    queue: 'skeleton.ping.created.q',
    queueOptions: { durable: true },
  })
  async handle(message: PingMessage, amqpMsg: AmqpMsg): Promise<void> {
    const headerCorrelationId = amqpMsg?.properties?.headers?.[CORRELATION_ID_HEADER] as
      | string
      | undefined;
    const correlationId = headerCorrelationId ?? message.correlationId;
    const scoped = this.log.forCorrelationId(correlationId);

    scoped.info({
      action: 'skeleton.ping.received',
      aggregateType: 'skeleton.ping',
      aggregateId: message.id,
    });

    await this.acks.insert({
      pingId: message.id,
      correlationId,
      status: 'processed',
    });

    scoped.success({
      action: 'skeleton.ping.ack_persisted',
      aggregateType: 'skeleton.ping',
      aggregateId: message.id,
    });
  }
}
