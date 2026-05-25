import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const OUTBOX_STATUS = {
  PENDING: 'PENDING',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED',
} as const;

export type OutboxStatus = (typeof OUTBOX_STATUS)[keyof typeof OUTBOX_STATUS];

@Entity({ name: 'outbox' })
@Index('IDX_outbox_status_occurred_at', ['status', 'occurredAt'])
@Index('IDX_outbox_aggregate', ['aggregateType', 'aggregateId'])
export class OutboxEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, name: 'aggregate_type' })
  aggregateType!: string;

  @Column({ type: 'varchar', length: 128, name: 'aggregate_id' })
  aggregateId!: string;

  @Column({ type: 'varchar', length: 128, name: 'event_type' })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 16, default: OUTBOX_STATUS.PENDING })
  status!: OutboxStatus;

  @Column({ type: 'timestamptz', name: 'occurred_at' })
  occurredAt!: Date;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  processedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ type: 'varchar', length: 64, name: 'correlation_id', nullable: true })
  correlationId!: string | null;

  @Column({ type: 'text', name: 'last_error', nullable: true })
  lastError!: string | null;
}
