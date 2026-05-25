import { ArchiveProductHandler } from './archive-product.handler';
import { ArchiveProductCommand } from './archive-product.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { buildProduct } from '../__test-fixtures__/build-product';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { ProductArchived } from '../../domain/events/product-archived.event';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { ArchivedProductIsImmutableError } from '../../domain/errors/archived-product-is-immutable.error';

const build = () => {
  const repo = new InMemoryProductRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    repo,
    publisher,
    handler: new ArchiveProductHandler(repo, publisher, new PassThroughUnitOfWork()),
  };
};

describe('ArchiveProductHandler', () => {
  it('archives a DRAFT product and publishes ProductArchived', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(buildProduct({ id: 'p1' }));

    await handler.execute(new ArchiveProductCommand('p1'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.status).toBe(ProductStatus.ARCHIVED);
    expect(publisher.byName(ProductArchived.EVENT_NAME)).toHaveLength(1);
  });

  it('archives an ACTIVE product', async () => {
    const { handler, repo } = build();
    repo.seed(
      buildProduct({
        id: 'p1',
        status: ProductStatus.ACTIVE,
        categoryIds: ['c1'],
        attributes: [['cor', 'azul']],
      }),
    );

    await handler.execute(new ArchiveProductCommand('p1'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.status).toBe(ProductStatus.ARCHIVED);
  });

  it('throws ProductNotFoundError when missing', async () => {
    const { handler } = build();
    await expect(handler.execute(new ArchiveProductCommand('missing'))).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });

  it('throws ArchivedProductIsImmutableError when already archived', async () => {
    const { handler, repo } = build();
    repo.seed(buildProduct({ id: 'p1', status: ProductStatus.ARCHIVED }));

    await expect(handler.execute(new ArchiveProductCommand('p1'))).rejects.toBeInstanceOf(
      ArchivedProductIsImmutableError,
    );
  });
});
