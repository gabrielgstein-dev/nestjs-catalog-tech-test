import { Category } from '../category';
import { CategoryId } from '../value-objects/category-id';
import { CategoryName } from '../value-objects/category-name';

export const CATEGORY_REPOSITORY = Symbol('CategoryRepository');

export interface CategoryRepository {
  /** Persists a new or existing category (upsert by id). */
  save(category: Category): Promise<void>;

  /** Returns the category by id, or null if not found. */
  findById(id: CategoryId): Promise<Category | null>;

  /**
   * Application-layer gate: checks whether a category with the given id exists.
   * Used by the create-category use case to validate that a referenced parent
   * actually exists (existence cannot be enforced as a pure entity invariant).
   */
  existsById(id: CategoryId): Promise<boolean>;

  /**
   * Application-layer gate: checks whether any category already uses this name,
   * optionally excluding a specific id (when renaming, exclude the category
   * being renamed). Used by create/rename use cases to enforce global name
   * uniqueness — this cannot be enforced as a pure entity invariant.
   */
  existsByName(name: CategoryName, exceptId?: CategoryId): Promise<boolean>;
}
