import { Product } from '../../domain/product';
import { CategoryId } from '../../../category/domain/value-objects/category-id';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductName } from '../../domain/value-objects/product-name';
import { ProductDescription } from '../../domain/value-objects/product-description';
import { ProductStatus, isProductStatus } from '../../domain/value-objects/product-status';
import { Attribute } from '../../domain/value-objects/attribute';
import { AttributeCollection } from '../../domain/value-objects/attribute-collection';
import { ProductEntity } from '../entities/product.entity';
import { ProductAttributeEntity } from '../entities/product-attribute.entity';
import { ProductCategoryEntity } from '../entities/product-category.entity';

export interface ProductPersistenceRow {
  product: {
    id: string;
    name: string;
    description: string | null;
    status: ProductStatus;
  };
  attributes: Array<{
    productId: string;
    key: string;
    value: string;
  }>;
  categoryIds: string[];
}

export interface ProductHydrationInput {
  product: ProductEntity;
  attributes: ProductAttributeEntity[];
  categories: ProductCategoryEntity[];
}

export const ProductMapper = {
  toDomain(input: ProductHydrationInput): Product {
    const { product, attributes, categories } = input;

    if (!isProductStatus(product.status)) {
      throw new Error(`Invalid product status in persistence: ${product.status}`);
    }

    const attrCollection = AttributeCollection.of(
      attributes.map((a) => Attribute.of(a.key, a.value)),
    );

    const categoryIds = categories.map((c) => CategoryId.of(c.categoryId));

    return Product.rehydrate({
      id: ProductId.of(product.id),
      name: ProductName.of(product.name),
      description: ProductDescription.of(product.description),
      status: product.status,
      categoryIds,
      attributes: attrCollection,
    });
  },

  toPersistence(product: Product): ProductPersistenceRow {
    return {
      product: {
        id: product.id.value,
        name: product.name.value,
        description: product.description.value,
        status: product.status,
      },
      attributes: product.attributes.toArray().map((a) => ({
        productId: product.id.value,
        key: a.key,
        value: a.value,
      })),
      categoryIds: product.categoryIds.map((c) => c.value),
    };
  },
};
