import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from './infra/entities/audit-log.entity';
import { ProcessedEventEntity } from './infra/entities/processed-event.entity';
import { ProcessDomainEventUseCase } from './application/process-domain-event.use-case';
import { AuditConsumer } from './presentation/messaging/audit.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity, ProcessedEventEntity])],
  providers: [ProcessDomainEventUseCase, AuditConsumer],
})
export class AuditModule {}
