import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Product } from '../../domain/product';
import { ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductName } from '../../domain/value-objects/product-name';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { ProductEntity } from '../entities/product.entity';
import { ProductAttributeEntity } from '../entities/product-attribute.entity';
import { ProductCategoryEntity } from '../entities/product-category.entity';
import { ProductMapper, ProductPersistenceRow } from '../mappers/product.mapper';
import { TransactionContext } from '../../../../../shared/application/transaction-context';
import { getAmbientManager } from '../../../../../shared/infra/database/get-manager';

@Injectable()
export class ProductRepositoryTypeOrm implements ProductRepository {
  constructor(private readonly dataSource: DataSource) {}

  async save(product: Product): Promise<void> {
    const row = ProductMapper.toPersistence(product);
    const ambient = TransactionContext.get();
    if (ambient) {
      await this.saveWith(ambient, row);
      return;
    }
    await this.dataSource.transaction((m) => this.saveWith(m, row));
  }

  private async saveWith(manager: EntityManager, row: ProductPersistenceRow): Promise<void> {
    await manager.query(
      `INSERT INTO product (id, name, description, status)
         VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             description = EXCLUDED.description,
             status = EXCLUDED.status,
             updated_at = now()`,
      [row.product.id, row.product.name, row.product.description, row.product.status],
    );

    await manager.delete(ProductAttributeEntity, { productId: row.product.id });
    if (row.attributes.length > 0) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(ProductAttributeEntity)
        .values(row.attributes)
        .execute();
    }

    await manager.delete(ProductCategoryEntity, { productId: row.product.id });
    if (row.categoryIds.length > 0) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(ProductCategoryEntity)
        .values(
          row.categoryIds.map((categoryId) => ({
            productId: row.product.id,
            categoryId,
          })),
        )
        .execute();
    }
  }

  async findById(id: ProductId): Promise<Product | null> {
    const manager = getAmbientManager(this.dataSource);
    const product = await manager.getRepository(ProductEntity).findOne({ where: { id: id.value } });
    if (!product) {
      return null;
    }

    const [attributes, categories] = await Promise.all([
      manager.getRepository(ProductAttributeEntity).find({ where: { productId: id.value } }),
      manager.getRepository(ProductCategoryEntity).find({ where: { productId: id.value } }),
    ]);

    return ProductMapper.toDomain({ product, attributes, categories });
  }

  async existsOtherWithSameNameExcludingArchived(
    name: ProductName,
    exceptId: ProductId,
  ): Promise<boolean> {
    const count = await getAmbientManager(this.dataSource)
      .getRepository(ProductEntity)
      .createQueryBuilder('p')
      .where('p.name = :name', { name: name.value })
      .andWhere('p.status <> :archived', { archived: ProductStatus.ARCHIVED })
      .andWhere('p.id <> :id', { id: exceptId.value })
      .getCount();
    return count > 0;
  }
}
