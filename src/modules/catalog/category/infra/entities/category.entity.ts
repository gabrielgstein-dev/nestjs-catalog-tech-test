import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'category' })
export class CategoryEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index('uq_category_name', { unique: true })
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => CategoryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent?: CategoryEntity | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
