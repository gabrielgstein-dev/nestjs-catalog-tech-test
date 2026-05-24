import { Product } from '../../domain/product';
import { ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductName } from '../../domain/value-objects/product-name';
import { ProductStatus } from '../../domain/value-objects/product-status';

export class InMemoryProductRepository implements ProductRepository {
  private readonly store = new Map<string, Product>();

  async save(product: Product): Promise<void> {
    this.store.set(product.id.value, product);
  }

  async findById(id: ProductId): Promise<Product | null> {
    return this.store.get(id.value) ?? null;
  }

  async existsOtherWithSameNameExcludingArchived(
    name: ProductName,
    exceptId: ProductId,
  ): Promise<boolean> {
    for (const product of this.store.values()) {
      if (product.id.equals(exceptId)) continue;
      if (product.status === ProductStatus.ARCHIVED) continue;
      if (product.name.equals(name)) return true;
    }
    return false;
  }

  size(): number {
    return this.store.size;
  }

  seed(product: Product): void {
    this.store.set(product.id.value, product);
  }
}
