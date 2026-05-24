import { Category } from '../../domain/category';
import { CategoryRepository } from '../../domain/ports/category.repository';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryName } from '../../domain/value-objects/category-name';

export class InMemoryCategoryRepository implements CategoryRepository {
  private readonly store = new Map<string, Category>();

  async save(category: Category): Promise<void> {
    this.store.set(category.id.value, category);
  }

  async findById(id: CategoryId): Promise<Category | null> {
    return this.store.get(id.value) ?? null;
  }

  async existsById(id: CategoryId): Promise<boolean> {
    return this.store.has(id.value);
  }

  async existsByName(name: CategoryName, exceptId?: CategoryId): Promise<boolean> {
    for (const cat of this.store.values()) {
      if (exceptId && cat.id.equals(exceptId)) continue;
      if (cat.name.equals(name)) return true;
    }
    return false;
  }

  size(): number {
    return this.store.size;
  }

  seed(category: Category): void {
    this.store.set(category.id.value, category);
  }
}
