import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { CATEGORY_REPOSITORY, CategoryRepository } from '../../domain/ports/category.repository';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryNotFoundError } from '../errors/category-not-found.error';
import { GetCategoryByIdQuery } from './get-category-by-id.query';

export interface CategoryView {
  id: string;
  name: string;
  parentId: string | null;
}

@QueryHandler(GetCategoryByIdQuery)
export class GetCategoryByIdHandler implements IQueryHandler<GetCategoryByIdQuery, CategoryView> {
  constructor(@Inject(CATEGORY_REPOSITORY) private readonly repo: CategoryRepository) {}

  async execute(query: GetCategoryByIdQuery): Promise<CategoryView> {
    const id = CategoryId.of(query.id);
    const category = await this.repo.findById(id);
    if (!category) {
      throw new CategoryNotFoundError(id.value);
    }
    return {
      id: category.id.value,
      name: category.name.value,
      parentId: category.parentId?.value ?? null,
    };
  }
}
