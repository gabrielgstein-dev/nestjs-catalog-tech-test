import { Category } from '../category';
import { CategoryId } from '../value-objects/category-id';
import { CategoryName } from '../value-objects/category-name';

export const CATEGORY_REPOSITORY = Symbol('CategoryRepository');

export interface CategoryRepository {
  save(category: Category): Promise<void>;

  findById(id: CategoryId): Promise<Category | null>;

  // Cross-aggregate gate: parent existence cannot be enforced as a pure entity invariant.
  existsById(id: CategoryId): Promise<boolean>;

  // Cross-aggregate gate: global name uniqueness cannot be enforced as a pure entity invariant.
  existsByName(name: CategoryName, exceptId?: CategoryId): Promise<boolean>;
}
