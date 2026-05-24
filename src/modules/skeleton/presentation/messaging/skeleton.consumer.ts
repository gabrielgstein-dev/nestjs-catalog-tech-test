import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { SkeletonAckEntity } from '../../infra/entities/skeleton-ack.entity';
import { SKELETON_ROUTING_KEY } from '../../infra/messaging/skeleton-routing';
import { CORRELATION_ID_HEADER } from '../../../../shared/infra/http/correlation-id.constants';

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
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(SkeletonConsumer.name);
  }

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

    const child = this.logger.logger.child({ correlationId, pingId: message.id });
    child.info('ping received from queue');

    await this.acks.insert({
      pingId: message.id,
      correlationId,
      status: 'processed',
    });

    child.info('ack persisted');
  }
}
