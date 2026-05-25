import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CATEGORY_REPOSITORY } from './category/domain/ports/category.repository';
import { PRODUCT_REPOSITORY } from './product/domain/ports/product.repository';
import { CategoryEntity } from './category/infra/entities/category.entity';
import { ProductEntity } from './product/infra/entities/product.entity';
import { ProductAttributeEntity } from './product/infra/entities/product-attribute.entity';
import { ProductCategoryEntity } from './product/infra/entities/product-category.entity';
import { CategoryRepositoryTypeOrm } from './category/infra/repositories/category.repository.typeorm';
import { ProductRepositoryTypeOrm } from './product/infra/repositories/product.repository.typeorm';
import { CreateCategoryHandler } from './category/application/commands/create-category.handler';
import { RenameCategoryHandler } from './category/application/commands/rename-category.handler';
import { ChangeCategoryParentHandler } from './category/application/commands/change-category-parent.handler';
import { GetCategoryByIdHandler } from './category/application/queries/get-category-by-id.handler';
import { ListCategoriesHandler } from './category/application/queries/list-categories.handler';
import { ListProductsHandler } from './product/application/queries/list-products.handler';
import { CategoryController } from './category/presentation/http/category.controller';
import { ProductController } from './product/presentation/http/product.controller';
import { CreateProductHandler } from './product/application/commands/create-product.handler';
import { RenameProductHandler } from './product/application/commands/rename-product.handler';
import { ChangeProductDescriptionHandler } from './product/application/commands/change-product-description.handler';
import { ActivateProductHandler } from './product/application/commands/activate-product.handler';
import { ArchiveProductHandler } from './product/application/commands/archive-product.handler';
import { AttachCategoryToProductHandler } from './product/application/commands/attach-category-to-product.handler';
import { DetachCategoryFromProductHandler } from './product/application/commands/detach-category-from-product.handler';
import { AddAttributeHandler } from './product/application/commands/add-attribute.handler';
import { UpdateAttributeHandler } from './product/application/commands/update-attribute.handler';
import { RemoveAttributeHandler } from './product/application/commands/remove-attribute.handler';
import { GetProductByIdHandler } from './product/application/queries/get-product-by-id.handler';

const CommandHandlers = [
  CreateCategoryHandler,
  RenameCategoryHandler,
  ChangeCategoryParentHandler,
  CreateProductHandler,
  RenameProductHandler,
  ChangeProductDescriptionHandler,
  ActivateProductHandler,
  ArchiveProductHandler,
  AttachCategoryToProductHandler,
  DetachCategoryFromProductHandler,
  AddAttributeHandler,
  UpdateAttributeHandler,
  RemoveAttributeHandler,
];

const QueryHandlers = [
  GetCategoryByIdHandler,
  ListCategoriesHandler,
  GetProductByIdHandler,
  ListProductsHandler,
];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      CategoryEntity,
      ProductEntity,
      ProductAttributeEntity,
      ProductCategoryEntity,
    ]),
  ],
  controllers: [CategoryController, ProductController],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: CategoryRepositoryTypeOrm },
    { provide: PRODUCT_REPOSITORY, useClass: ProductRepositoryTypeOrm },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [CATEGORY_REPOSITORY, PRODUCT_REPOSITORY],
})
export class CatalogModule {}
