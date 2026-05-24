import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkeletonPingEntity } from '../../infra/entities/skeleton-ping.entity';
import { SkeletonAckEntity } from '../../infra/entities/skeleton-ack.entity';
import { GetPingQuery } from './get-ping.query';

export interface PingState {
  id: string;
  correlationId: string;
  payload: string;
  createdAt: Date;
  ack: {
    status: string;
    ackedAt: Date;
  } | null;
}

@QueryHandler(GetPingQuery)
export class GetPingHandler implements IQueryHandler<GetPingQuery, PingState> {
  constructor(
    @InjectRepository(SkeletonPingEntity)
    private readonly pings: Repository<SkeletonPingEntity>,
    @InjectRepository(SkeletonAckEntity)
    private readonly acks: Repository<SkeletonAckEntity>,
  ) {}

  async execute(query: GetPingQuery): Promise<PingState> {
    const ping = await this.pings.findOne({ where: { id: query.id } });
    if (!ping) {
      throw new NotFoundException(`ping ${query.id} not found`);
    }
    const ack = await this.acks.findOne({
      where: { pingId: query.id },
      order: { ackedAt: 'DESC' },
    });
    return {
      id: ping.id,
      correlationId: ping.correlationId,
      payload: ping.payload,
      createdAt: ping.createdAt,
      ack: ack ? { status: ack.status, ackedAt: ack.ackedAt } : null,
    };
  }
}
