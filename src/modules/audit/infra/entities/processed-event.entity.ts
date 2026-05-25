import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

/**
 * Inbox table: dedupe by (event_id, consumer) so the same event delivered
 * twice (retry/redelivery) is recorded exactly once per consumer.
 */
@Entity({ name: 'processed_event' })
export class ProcessedEventEntity {
  @PrimaryColumn({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  consumer!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'processed_at' })
  processedAt!: Date;
}
