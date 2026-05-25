import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from '../../infra/entities/product.entity';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { ListProductsQuery } from './list-products.query';

export interface ProductListItem {
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
}

export interface PagedProductView {
  items: ProductListItem[];
  total: number;
  limit: number;
  offset: number;
}

@QueryHandler(ListProductsQuery)
export class ListProductsHandler implements IQueryHandler<ListProductsQuery, PagedProductView> {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>,
  ) {}

  async execute(query: ListProductsQuery): Promise<PagedProductView> {
    const limit = Math.max(1, Math.min(query.limit, 200));
    const offset = Math.max(0, query.offset);
    const where = query.status ? { status: query.status } : {};
    const [rows, total] = await this.repo.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { name: 'ASC' },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        status: r.status as ProductStatus,
      })),
      total,
      limit,
      offset,
    };
  }
}
