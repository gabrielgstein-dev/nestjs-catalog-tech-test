import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ProductEntity } from './product.entity';

@Entity({ name: 'product_attribute' })
export class ProductAttributeEntity {
  @PrimaryColumn({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  key!: string;

  @Column({ type: 'varchar', length: 500 })
  value!: string;

  @ManyToOne(() => ProductEntity, (product) => product.attributes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity;
}
