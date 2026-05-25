import { RenameProductHandler } from './rename-product.handler';
import { RenameProductCommand } from './rename-product.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { silentBusinessActionLogger } from '../../../../../shared/infra/logging/__test-fixtures__/silent-business-action-logger';
import { buildProduct } from '../__test-fixtures__/build-product';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { ProductRenamed } from '../../domain/events/product-renamed.event';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { ArchivedProductIsImmutableError } from '../../domain/errors/archived-product-is-immutable.error';

const build = () => {
  const repo = new InMemoryProductRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    repo,
    publisher,
    handler: new RenameProductHandler(
      repo,
      publisher,
      new PassThroughUnitOfWork(),
      silentBusinessActionLogger(),
    ),
  };
};

describe('RenameProductHandler', () => {
  it('renames an existing product and publishes ProductRenamed', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(buildProduct({ id: 'p1', name: 'Old' }));

    await handler.execute(new RenameProductCommand('p1', 'New'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.name.value).toBe('New');
    expect(publisher.byName(ProductRenamed.EVENT_NAME)).toHaveLength(1);
  });

  it('throws ProductNotFoundError when the product does not exist', async () => {
    const { handler } = build();

    await expect(handler.execute(new RenameProductCommand('missing', 'x'))).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });

  it('propagates ArchivedProductIsImmutableError from the domain', async () => {
    const { handler, repo } = build();
    repo.seed(
      buildProduct({
        id: 'p1',
        status: ProductStatus.ARCHIVED,
        categoryIds: ['c1'],
        attributes: [['cor', 'azul']],
      }),
    );

    await expect(handler.execute(new RenameProductCommand('p1', 'Outro'))).rejects.toBeInstanceOf(
      ArchivedProductIsImmutableError,
    );
  });
});
