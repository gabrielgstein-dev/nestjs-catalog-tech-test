import { RemoveAttributeHandler } from './remove-attribute.handler';
import { RemoveAttributeCommand } from './remove-attribute.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { silentBusinessActionLogger } from '../../../../../shared/infra/logging/__test-fixtures__/silent-business-action-logger';
import { buildProduct } from '../__test-fixtures__/build-product';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { AttributeRemoved } from '../../domain/events/attribute-removed.event';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { AttributeKeyNotFoundError } from '../../domain/errors/attribute-key-not-found.error';
import { ActiveProductInvariantViolatedError } from '../../domain/errors/active-product-invariant-violated.error';

const build = () => {
  const repo = new InMemoryProductRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    repo,
    publisher,
    handler: new RemoveAttributeHandler(
      repo,
      publisher,
      new PassThroughUnitOfWork(),
      silentBusinessActionLogger(),
    ),
  };
};

describe('RemoveAttributeHandler', () => {
  it('removes an existing attribute and publishes AttributeRemoved', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(
      buildProduct({
        id: 'p1',
        attributes: [
          ['cor', 'azul'],
          ['material', 'metal'],
        ],
      }),
    );

    await handler.execute(new RemoveAttributeCommand('p1', 'cor'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.attributes.has('cor')).toBe(false);
    expect(publisher.byName(AttributeRemoved.EVENT_NAME)).toHaveLength(1);
  });

  it('throws ProductNotFoundError when the product is missing', async () => {
    const { handler } = build();
    await expect(
      handler.execute(new RemoveAttributeCommand('missing', 'cor')),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('propagates AttributeKeyNotFoundError from the domain', async () => {
    const { handler, repo } = build();
    repo.seed(buildProduct({ id: 'p1' }));

    await expect(handler.execute(new RemoveAttributeCommand('p1', 'cor'))).rejects.toBeInstanceOf(
      AttributeKeyNotFoundError,
    );
  });

  it('propagates ActiveProductInvariantViolatedError when removing the last attribute on ACTIVE', async () => {
    const { handler, repo } = build();
    repo.seed(
      buildProduct({
        id: 'p1',
        status: ProductStatus.ACTIVE,
        categoryIds: ['c1'],
        attributes: [['cor', 'azul']],
      }),
    );

    await expect(handler.execute(new RemoveAttributeCommand('p1', 'cor'))).rejects.toBeInstanceOf(
      ActiveProductInvariantViolatedError,
    );
  });
});
