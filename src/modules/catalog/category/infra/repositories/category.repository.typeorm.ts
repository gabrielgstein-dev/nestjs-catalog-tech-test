import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Category } from '../../domain/category';
import { CategoryRepository } from '../../domain/ports/category.repository';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryName } from '../../domain/value-objects/category-name';
import { CategoryEntity } from '../entities/category.entity';
import { CategoryMapper } from '../mappers/category.mapper';

@Injectable()
export class CategoryRepositoryTypeOrm implements CategoryRepository {
  constructor(private readonly dataSource: DataSource) {}

  async save(category: Category): Promise<void> {
    const row = CategoryMapper.toPersistence(category);
    await this.dataSource.query(
      `INSERT INTO category (id, name, parent_id)
         VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             parent_id = EXCLUDED.parent_id,
             updated_at = now()`,
      [row.id, row.name, row.parentId],
    );
  }

  async findById(id: CategoryId): Promise<Category | null> {
    const repo = this.dataSource.getRepository(CategoryEntity);
    const entity = await repo.findOne({ where: { id: id.value } });
    return entity ? CategoryMapper.toDomain(entity) : null;
  }

  async existsById(id: CategoryId): Promise<boolean> {
    const repo = this.dataSource.getRepository(CategoryEntity);
    return repo.exists({ where: { id: id.value } });
  }

  async existsByName(name: CategoryName, exceptId?: CategoryId): Promise<boolean> {
    const repo = this.dataSource.getRepository(CategoryEntity);
    const qb = repo.createQueryBuilder('c').where('c.name = :name', { name: name.value });
    if (exceptId) {
      qb.andWhere('c.id <> :id', { id: exceptId.value });
    }
    return (await qb.getCount()) > 0;
  }
}
