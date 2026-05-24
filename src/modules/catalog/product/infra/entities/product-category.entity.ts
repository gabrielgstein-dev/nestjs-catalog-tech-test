import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CategoryEntity } from '../../../category/infra/entities/category.entity';
import { ProductEntity } from './product.entity';

@Entity({ name: 'product_category' })
export class ProductCategoryEntity {
  @PrimaryColumn({ type: 'uuid', name: 'product_id' })
  productId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'category_id' })
  categoryId!: string;

  @ManyToOne(() => ProductEntity, (product) => product.categories, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product?: ProductEntity;

  @ManyToOne(() => CategoryEntity, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category?: CategoryEntity;
}
