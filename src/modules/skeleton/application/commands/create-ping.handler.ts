import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { randomUUID } from 'node:crypto';
import { SkeletonPingEntity } from '../../infra/entities/skeleton-ping.entity';
import { AppConfigService } from '../../../../shared/config/app-config.service';
import { SKELETON_ROUTING_KEY } from '../../infra/messaging/skeleton-routing';
import { CORRELATION_ID_HEADER } from '../../../../shared/infra/http/correlation-id.constants';
import { BusinessActionLogger } from '../../../../shared/infra/logging/business-action.logger';
import { CreatePingCommand } from './create-ping.command';

export interface CreatePingResult {
  id: string;
  correlationId: string;
}

@CommandHandler(CreatePingCommand)
export class CreatePingHandler implements ICommandHandler<CreatePingCommand, CreatePingResult> {
  constructor(
    @InjectRepository(SkeletonPingEntity)
    private readonly pings: Repository<SkeletonPingEntity>,
    private readonly amqp: AmqpConnection,
    private readonly config: AppConfigService,
    private readonly log: BusinessActionLogger,
  ) {}

  async execute(command: CreatePingCommand): Promise<CreatePingResult> {
    const id = randomUUID();
    const { payload, correlationId } = command;

    await this.pings.insert({ id, correlationId, payload });
    this.log.success({
      action: 'skeleton.ping.persisted',
      aggregateType: 'skeleton.ping',
      aggregateId: id,
    });

    await this.amqp.publish(
      this.config.rabbitmq.exchange,
      SKELETON_ROUTING_KEY,
      { id, payload, correlationId },
      { headers: { [CORRELATION_ID_HEADER]: correlationId }, persistent: true },
    );
    this.log.success({
      action: 'skeleton.ping.published',
      aggregateType: 'skeleton.ping',
      aggregateId: id,
    });

    return { id, correlationId };
  }
}
