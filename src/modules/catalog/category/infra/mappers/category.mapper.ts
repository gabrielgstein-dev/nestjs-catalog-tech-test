import { Category } from '../../domain/category';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryName } from '../../domain/value-objects/category-name';
import { CategoryEntity } from '../entities/category.entity';

export interface CategoryPersistenceRow {
  id: string;
  name: string;
  parentId: string | null;
}

export const CategoryMapper = {
  toDomain(entity: CategoryEntity): Category {
    return Category.rehydrate({
      id: CategoryId.of(entity.id),
      name: CategoryName.of(entity.name),
      parentId: entity.parentId ? CategoryId.of(entity.parentId) : null,
    });
  },

  toPersistence(category: Category): CategoryPersistenceRow {
    return {
      id: category.id.value,
      name: category.name.value,
      parentId: category.parentId?.value ?? null,
    };
  },
};
