import { AddAttributeHandler } from './add-attribute.handler';
import { AddAttributeCommand } from './add-attribute.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { silentBusinessActionLogger } from '../../../../../shared/infra/logging/__test-fixtures__/silent-business-action-logger';
import { buildProduct } from '../__test-fixtures__/build-product';
import { ProductId } from '../../domain/value-objects/product-id';
import { AttributeAdded } from '../../domain/events/attribute-added.event';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { DuplicateAttributeKeyError } from '../../domain/errors/duplicate-attribute-key.error';

const build = () => {
  const repo = new InMemoryProductRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    repo,
    publisher,
    handler: new AddAttributeHandler(
      repo,
      publisher,
      new PassThroughUnitOfWork(),
      silentBusinessActionLogger(),
    ),
  };
};

describe('AddAttributeHandler', () => {
  it('adds a new attribute and publishes AttributeAdded', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(buildProduct({ id: 'p1' }));

    await handler.execute(new AddAttributeCommand('p1', 'cor', 'azul'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.attributes.get('cor')?.value).toBe('azul');
    expect(publisher.byName(AttributeAdded.EVENT_NAME)).toHaveLength(1);
  });

  it('throws ProductNotFoundError when the product is missing', async () => {
    const { handler } = build();
    await expect(
      handler.execute(new AddAttributeCommand('missing', 'cor', 'azul')),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('propagates DuplicateAttributeKeyError from the domain', async () => {
    const { handler, repo } = build();
    repo.seed(buildProduct({ id: 'p1', attributes: [['cor', 'azul']] }));

    await expect(
      handler.execute(new AddAttributeCommand('p1', 'cor', 'verde')),
    ).rejects.toBeInstanceOf(DuplicateAttributeKeyError);
  });
});
