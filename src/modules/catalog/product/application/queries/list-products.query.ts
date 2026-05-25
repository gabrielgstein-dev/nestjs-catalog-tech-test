import { ProductStatus } from '../../domain/value-objects/product-status';

export class ListProductsQuery {
  constructor(
    public readonly limit: number = 50,
    public readonly offset: number = 0,
    public readonly status: ProductStatus | null = null,
  ) {}
}
