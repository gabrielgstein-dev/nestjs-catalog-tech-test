import { Product } from '../product';
import { ProductId } from '../value-objects/product-id';
import { ProductName } from '../value-objects/product-name';

export const PRODUCT_REPOSITORY = Symbol('ProductRepository');

export interface ProductRepository {
  /** Persists a new or existing product (upsert by id). */
  save(product: Product): Promise<void>;

  /** Returns the product by id, or null if not found. */
  findById(id: ProductId): Promise<Product | null>;

  /**
   * Application-layer gate used by the activate-product use case.
   *
   * Returns true if there is another product (id !== exceptId) with the same
   * name in any status OTHER THAN archived. The unique-name rule applies only
   * at activation time — two DRAFT products with the same name are allowed to
   * coexist; activation is only blocked when an ACTIVE (or another DRAFT being
   * activated concurrently — race resolved at infra-level constraint) product
   * already holds the name. Archived products release the name back.
   *
   * Pure entity invariants cannot enforce this (the entity has no access to
   * other aggregates), so it is modelled as a use-case gate.
   */
  existsOtherWithSameNameExcludingArchived(
    name: ProductName,
    exceptId: ProductId,
  ): Promise<boolean>;
}
