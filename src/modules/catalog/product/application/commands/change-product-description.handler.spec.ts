import { ChangeProductDescriptionHandler } from './change-product-description.handler';
import { ChangeProductDescriptionCommand } from './change-product-description.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { buildProduct } from '../__test-fixtures__/build-product';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { ProductDescriptionChanged } from '../../domain/events/product-description-changed.event';
import { ProductNotFoundError } from '../errors/product-not-found.error';

const build = () => {
  const repo = new InMemoryProductRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    repo,
    publisher,
    handler: new ChangeProductDescriptionHandler(repo, publisher, new PassThroughUnitOfWork()),
  };
};

describe('ChangeProductDescriptionHandler', () => {
  it('updates the description and publishes ProductDescriptionChanged', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(buildProduct({ id: 'p1' }));

    await handler.execute(new ChangeProductDescriptionCommand('p1', 'new desc'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.description.value).toBe('new desc');
    expect(publisher.byName(ProductDescriptionChanged.EVENT_NAME)).toHaveLength(1);
  });

  it('allows changing description on ARCHIVED products', async () => {
    const { handler, repo } = build();
    repo.seed(
      buildProduct({
        id: 'p1',
        status: ProductStatus.ARCHIVED,
        categoryIds: ['c1'],
        attributes: [['cor', 'azul']],
      }),
    );

    await expect(
      handler.execute(new ChangeProductDescriptionCommand('p1', 'still mutable')),
    ).resolves.toBeUndefined();
  });

  it('throws ProductNotFoundError when the product does not exist', async () => {
    const { handler } = build();
    await expect(
      handler.execute(new ChangeProductDescriptionCommand('missing', 'x')),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });
});
