import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_log' })
@Index('IDX_audit_log_aggregate', ['aggregateType', 'aggregateId'])
@Index('IDX_audit_log_event_type', ['eventType'])
@Index('IDX_audit_log_correlation', ['correlationId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @Column({ type: 'varchar', length: 64, name: 'aggregate_type' })
  aggregateType!: string;

  @Column({ type: 'varchar', length: 128, name: 'aggregate_id' })
  aggregateId!: string;

  @Column({ type: 'varchar', length: 128, name: 'event_type' })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64, name: 'correlation_id', nullable: true })
  correlationId!: string | null;

  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'recorded_at' })
  recordedAt!: Date;
}
