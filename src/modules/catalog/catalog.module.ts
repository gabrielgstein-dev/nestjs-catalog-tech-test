import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CATEGORY_REPOSITORY } from './category/domain/ports/category.repository';
import { PRODUCT_REPOSITORY } from './product/domain/ports/product.repository';
import { CategoryEntity } from './category/infra/entities/category.entity';
import { ProductEntity } from './product/infra/entities/product.entity';
import { ProductAttributeEntity } from './product/infra/entities/product-attribute.entity';
import { ProductCategoryEntity } from './product/infra/entities/product-category.entity';
import { CategoryRepositoryTypeOrm } from './category/infra/repositories/category.repository.typeorm';
import { ProductRepositoryTypeOrm } from './product/infra/repositories/product.repository.typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CategoryEntity,
      ProductEntity,
      ProductAttributeEntity,
      ProductCategoryEntity,
    ]),
  ],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: CategoryRepositoryTypeOrm },
    { provide: PRODUCT_REPOSITORY, useClass: ProductRepositoryTypeOrm },
  ],
  exports: [CATEGORY_REPOSITORY, PRODUCT_REPOSITORY],
})
export class CatalogModule {}
