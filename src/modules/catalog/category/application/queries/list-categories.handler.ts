import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryEntity } from '../../infra/entities/category.entity';
import { CategoryView } from './get-category-by-id.handler';
import { ListCategoriesQuery } from './list-categories.query';

export interface PagedCategoryView {
  items: CategoryView[];
  total: number;
  limit: number;
  offset: number;
}

@QueryHandler(ListCategoriesQuery)
export class ListCategoriesHandler
  implements IQueryHandler<ListCategoriesQuery, PagedCategoryView>
{
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly repo: Repository<CategoryEntity>,
  ) {}

  async execute(query: ListCategoriesQuery): Promise<PagedCategoryView> {
    const limit = Math.max(1, Math.min(query.limit, 200));
    const offset = Math.max(0, query.offset);
    const [rows, total] = await this.repo.findAndCount({
      take: limit,
      skip: offset,
      order: { name: 'ASC' },
    });
    return {
      items: rows.map((r) => ({ id: r.id, name: r.name, parentId: r.parentId })),
      total,
      limit,
      offset,
    };
  }
}
