import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { Category } from '../../src/modules/catalog/category/domain/category';
import { CategoryId } from '../../src/modules/catalog/category/domain/value-objects/category-id';
import { CategoryName } from '../../src/modules/catalog/category/domain/value-objects/category-name';
import { CategoryRepositoryTypeOrm } from '../../src/modules/catalog/category/infra/repositories/category.repository.typeorm';
import { Product } from '../../src/modules/catalog/product/domain/product';
import { ProductId } from '../../src/modules/catalog/product/domain/value-objects/product-id';
import { ProductName } from '../../src/modules/catalog/product/domain/value-objects/product-name';
import { ProductDescription } from '../../src/modules/catalog/product/domain/value-objects/product-description';
import { ProductStatus } from '../../src/modules/catalog/product/domain/value-objects/product-status';
import { Attribute } from '../../src/modules/catalog/product/domain/value-objects/attribute';
import { AttributeCollection } from '../../src/modules/catalog/product/domain/value-objects/attribute-collection';

export interface BuildProductOptions {
  id?: ProductId;
  name?: string;
  description?: string | null;
  status?: ProductStatus;
  categoryIds?: CategoryId[];
  attributes?: Attribute[];
}

export function buildProduct(opts: BuildProductOptions = {}): Product {
  const status = opts.status ?? ProductStatus.DRAFT;
  const id = opts.id ?? ProductId.of(randomUUID());
  const name = ProductName.of(opts.name ?? 'Product');
  const description = ProductDescription.of(opts.description ?? null);
  const categoryIds = opts.categoryIds ?? [];
  const attributes = opts.attributes ?? [];

  if (status === ProductStatus.DRAFT && categoryIds.length === 0 && attributes.length === 0) {
    return Product.create({ id, name, description });
  }

  return Product.rehydrate({
    id,
    name,
    description,
    status,
    categoryIds,
    attributes: AttributeCollection.of(attributes),
  });
}

export async function seedCategory(dataSource: DataSource, name: string): Promise<CategoryId> {
  const repo = new CategoryRepositoryTypeOrm(dataSource);
  const id = CategoryId.of(randomUUID());
  await repo.save(Category.create({ id, name: CategoryName.of(name) }));
  return id;
}

export function newCategory(name: string, parent?: CategoryId): Category {
  return Category.create({
    id: CategoryId.of(randomUUID()),
    name: CategoryName.of(name),
    parentId: parent,
  });
}
