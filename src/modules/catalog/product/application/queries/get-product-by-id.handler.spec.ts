import { GetProductByIdHandler } from './get-product-by-id.handler';
import { GetProductByIdQuery } from './get-product-by-id.query';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { buildProduct } from '../__test-fixtures__/build-product';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { ProductNotFoundError } from '../errors/product-not-found.error';

const build = () => {
  const repo = new InMemoryProductRepository();
  return { repo, handler: new GetProductByIdHandler(repo) };
};

describe('GetProductByIdHandler', () => {
  it('returns a flat view of the product', async () => {
    const { handler, repo } = build();
    repo.seed(
      buildProduct({
        id: 'p1',
        name: 'Cadeira',
        description: 'Premium',
        status: ProductStatus.ACTIVE,
        categoryIds: ['c1', 'c2'],
        attributes: [
          ['cor', 'azul'],
          ['material', 'metal'],
        ],
      }),
    );

    const result = await handler.execute(new GetProductByIdQuery('p1'));

    expect(result).toEqual({
      id: 'p1',
      name: 'Cadeira',
      description: 'Premium',
      status: ProductStatus.ACTIVE,
      categoryIds: ['c1', 'c2'],
      attributes: [
        { key: 'cor', value: 'azul' },
        { key: 'material', value: 'metal' },
      ],
    });
  });

  it('throws ProductNotFoundError when missing', async () => {
    const { handler } = build();
    await expect(handler.execute(new GetProductByIdQuery('missing'))).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });
});
