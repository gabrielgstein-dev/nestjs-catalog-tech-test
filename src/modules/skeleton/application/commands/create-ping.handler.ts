import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { randomUUID } from 'node:crypto';
import { SkeletonPingEntity } from '../../infra/entities/skeleton-ping.entity';
import { AppConfigService } from '../../../../shared/config/app-config.service';
import { SKELETON_ROUTING_KEY } from '../../infra/messaging/skeleton-routing';
import { CORRELATION_ID_HEADER } from '../../../../shared/infra/http/correlation-id.constants';
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
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CreatePingHandler.name);
  }

  async execute(command: CreatePingCommand): Promise<CreatePingResult> {
    const id = randomUUID();
    const { payload, correlationId } = command;

    await this.pings.insert({ id, correlationId, payload });
    this.logger.info({ correlationId, pingId: id }, 'ping persisted');

    await this.amqp.publish(
      this.config.rabbitmq.exchange,
      SKELETON_ROUTING_KEY,
      { id, payload, correlationId },
      { headers: { [CORRELATION_ID_HEADER]: correlationId }, persistent: true },
    );
    this.logger.info({ correlationId, pingId: id }, 'ping published');

    return { id, correlationId };
  }
}
