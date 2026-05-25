import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'processed_event' })
export class ProcessedEventEntity {
  @PrimaryColumn({ type: 'uuid', name: 'event_id' })
  eventId!: string;

  @PrimaryColumn({ type: 'varchar', length: 64 })
  consumer!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'processed_at' })
  processedAt!: Date;
}
