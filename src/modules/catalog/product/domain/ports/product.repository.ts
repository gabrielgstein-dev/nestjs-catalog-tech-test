import { Product } from '../product';
import { ProductId } from '../value-objects/product-id';
import { ProductName } from '../value-objects/product-name';

export const PRODUCT_REPOSITORY = Symbol('ProductRepository');

export interface ProductRepository {
  save(product: Product): Promise<void>;

  findById(id: ProductId): Promise<Product | null>;

  // Name uniqueness applies only at activation: DRAFTs may share a name; archived releases it.
  // Concurrent activations are resolved by an infra-level constraint.
  existsOtherWithSameNameExcludingArchived(
    name: ProductName,
    exceptId: ProductId,
  ): Promise<boolean>;
}
