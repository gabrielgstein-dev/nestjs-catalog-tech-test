import { DetachCategoryFromProductHandler } from './detach-category-from-product.handler';
import { DetachCategoryFromProductCommand } from './detach-category-from-product.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { buildProduct } from '../__test-fixtures__/build-product';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { CategoryDetachedFromProduct } from '../../domain/events/category-detached-from-product.event';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { ActiveProductInvariantViolatedError } from '../../domain/errors/active-product-invariant-violated.error';

const build = () => {
  const repo = new InMemoryProductRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    repo,
    publisher,
    handler: new DetachCategoryFromProductHandler(repo, publisher, new PassThroughUnitOfWork()),
  };
};

describe('DetachCategoryFromProductHandler', () => {
  it('detaches an attached category and publishes the event', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(buildProduct({ id: 'p1', categoryIds: ['c1', 'c2'] }));

    await handler.execute(new DetachCategoryFromProductCommand('p1', 'c1'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.categoryIds.map((c) => c.value)).toEqual(['c2']);
    expect(publisher.byName(CategoryDetachedFromProduct.EVENT_NAME)).toHaveLength(1);
  });

  it('is a no-op when the category is not attached (no event published)', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(buildProduct({ id: 'p1', categoryIds: ['c1'] }));

    await handler.execute(new DetachCategoryFromProductCommand('p1', 'not-attached'));

    expect(publisher.published).toHaveLength(0);
  });

  it('throws ProductNotFoundError when missing', async () => {
    const { handler } = build();
    await expect(
      handler.execute(new DetachCategoryFromProductCommand('missing', 'c1')),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('propagates ActiveProductInvariantViolatedError when detaching the last category on ACTIVE', async () => {
    const { handler, repo } = build();
    repo.seed(
      buildProduct({
        id: 'p1',
        status: ProductStatus.ACTIVE,
        categoryIds: ['c1'],
        attributes: [['cor', 'azul']],
      }),
    );

    await expect(
      handler.execute(new DetachCategoryFromProductCommand('p1', 'c1')),
    ).rejects.toBeInstanceOf(ActiveProductInvariantViolatedError);
  });
});
