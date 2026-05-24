import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'skeleton_ack' })
export class SkeletonAckEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  pingId!: string;

  @Column({ type: 'varchar', length: 64 })
  correlationId!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  ackedAt!: Date;
}
