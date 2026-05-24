import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'skeleton_ping' })
export class SkeletonPingEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  correlationId!: string;

  @Column({ type: 'varchar', length: 255 })
  payload!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
