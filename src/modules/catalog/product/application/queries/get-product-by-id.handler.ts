import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PRODUCT_REPOSITORY, ProductRepository } from '../../domain/ports/product.repository';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { GetProductByIdQuery } from './get-product-by-id.query';

export interface ProductView {
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  categoryIds: string[];
  attributes: Array<{ key: string; value: string }>;
}

@QueryHandler(GetProductByIdQuery)
export class GetProductByIdHandler implements IQueryHandler<GetProductByIdQuery, ProductView> {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository) {}

  async execute(query: GetProductByIdQuery): Promise<ProductView> {
    const id = ProductId.of(query.id);
    const product = await this.repo.findById(id);
    if (!product) {
      throw new ProductNotFoundError(id.value);
    }
    return {
      id: product.id.value,
      name: product.name.value,
      description: product.description.value,
      status: product.status,
      categoryIds: product.categoryIds.map((c) => c.value),
      attributes: product.attributes.toArray().map((a) => ({ key: a.key, value: a.value })),
    };
  }
}
