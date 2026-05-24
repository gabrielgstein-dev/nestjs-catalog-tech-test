import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkeletonPingEntity } from './infra/entities/skeleton-ping.entity';
import { SkeletonAckEntity } from './infra/entities/skeleton-ack.entity';
import { CreatePingHandler } from './application/commands/create-ping.handler';
import { GetPingHandler } from './application/queries/get-ping.handler';
import { SkeletonController } from './presentation/http/skeleton.controller';
import { SkeletonConsumer } from './presentation/messaging/skeleton.consumer';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([SkeletonPingEntity, SkeletonAckEntity])],
  controllers: [SkeletonController],
  providers: [CreatePingHandler, GetPingHandler, SkeletonConsumer],
})
export class SkeletonModule {}
