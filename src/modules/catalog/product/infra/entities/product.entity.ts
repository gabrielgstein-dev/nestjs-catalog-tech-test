import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductAttributeEntity } from './product-attribute.entity';
import { ProductCategoryEntity } from './product-category.entity';

@Entity({ name: 'product' })
export class ProductEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 16 })
  status!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @OneToMany(() => ProductAttributeEntity, (attr) => attr.product, {
    cascade: false,
  })
  attributes?: ProductAttributeEntity[];

  @OneToMany(() => ProductCategoryEntity, (pc) => pc.product, {
    cascade: false,
  })
  categories?: ProductCategoryEntity[];
}
