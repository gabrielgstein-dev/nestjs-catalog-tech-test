import { GetCategoryByIdHandler } from './get-category-by-id.handler';
import { GetCategoryByIdQuery } from './get-category-by-id.query';
import { InMemoryCategoryRepository } from '../__test-fixtures__/in-memory-category.repository';
import { Category } from '../../domain/category';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryName } from '../../domain/value-objects/category-name';
import { CategoryNotFoundError } from '../errors/category-not-found.error';

const build = () => {
  const repo = new InMemoryCategoryRepository();
  return { repo, handler: new GetCategoryByIdHandler(repo) };
};

describe('GetCategoryByIdHandler', () => {
  it('returns a flat view of the category', async () => {
    const { handler, repo } = build();
    repo.seed(
      Category.rehydrate({
        id: CategoryId.of('c1'),
        name: CategoryName.of('Eletrônicos'),
        parentId: CategoryId.of('p1'),
      }),
    );

    const result = await handler.execute(new GetCategoryByIdQuery('c1'));

    expect(result).toEqual({ id: 'c1', name: 'Eletrônicos', parentId: 'p1' });
  });

  it('throws CategoryNotFoundError when missing', async () => {
    const { handler } = build();

    await expect(handler.execute(new GetCategoryByIdQuery('missing'))).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });
});
