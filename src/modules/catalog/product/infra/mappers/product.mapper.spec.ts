import { ProductMapper } from './product.mapper';
import { ProductEntity } from '../entities/product.entity';
import { ProductAttributeEntity } from '../entities/product-attribute.entity';
import { ProductCategoryEntity } from '../entities/product-category.entity';
import { randomUUID } from 'node:crypto';

function makeProductEntity(overrides: Partial<ProductEntity> = {}): ProductEntity {
  const e = new ProductEntity();
  e.id = overrides.id ?? randomUUID();
  e.name = overrides.name ?? 'Test Product';
  e.description = overrides.description ?? null;
  e.status = overrides.status ?? 'DRAFT';
  e.createdAt = overrides.createdAt ?? new Date();
  e.updatedAt = overrides.updatedAt ?? new Date();
  return e;
}

// MENOR 7 — mapper com status corrompido na linha do banco
describe('ProductMapper.toDomain', () => {
  it('throws when the persisted status is not a valid ProductStatus value', () => {
    const corrupt = makeProductEntity({ status: 'INVALID_STATUS' });

    expect(() =>
      ProductMapper.toDomain({
        product: corrupt,
        attributes: [] as ProductAttributeEntity[],
        categories: [] as ProductCategoryEntity[],
      }),
    ).toThrow(/Invalid product status in persistence/);
  });

  it('maps a DRAFT product with no attributes or categories correctly', () => {
    const entity = makeProductEntity({ status: 'DRAFT', description: null });
    const product = ProductMapper.toDomain({
      product: entity,
      attributes: [],
      categories: [],
    });
    expect(product.id.value).toBe(entity.id);
    expect(product.name.value).toBe(entity.name);
    expect(product.description.value).toBeNull();
    expect(product.attributes.isEmpty()).toBe(true);
    expect(product.categoryIds).toEqual([]);
  });
});
