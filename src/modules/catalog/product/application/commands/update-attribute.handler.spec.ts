import { UpdateAttributeHandler } from './update-attribute.handler';
import { UpdateAttributeCommand } from './update-attribute.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { buildProduct } from '../__test-fixtures__/build-product';
import { ProductId } from '../../domain/value-objects/product-id';
import { AttributeUpdated } from '../../domain/events/attribute-updated.event';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { AttributeKeyNotFoundError } from '../../domain/errors/attribute-key-not-found.error';

const build = () => {
  const repo = new InMemoryProductRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return { repo, publisher, handler: new UpdateAttributeHandler(repo, publisher) };
};

describe('UpdateAttributeHandler', () => {
  it('updates an existing attribute and publishes AttributeUpdated', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(buildProduct({ id: 'p1', attributes: [['cor', 'azul']] }));

    await handler.execute(new UpdateAttributeCommand('p1', 'cor', 'verde'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.attributes.get('cor')?.value).toBe('verde');
    expect(publisher.byName(AttributeUpdated.EVENT_NAME)).toHaveLength(1);
  });

  it('is a no-op when value does not change (no event published)', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(buildProduct({ id: 'p1', attributes: [['cor', 'azul']] }));

    await handler.execute(new UpdateAttributeCommand('p1', 'cor', 'azul'));

    expect(publisher.published).toHaveLength(0);
  });

  it('throws ProductNotFoundError when the product is missing', async () => {
    const { handler } = build();
    await expect(
      handler.execute(new UpdateAttributeCommand('missing', 'cor', 'azul')),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('propagates AttributeKeyNotFoundError from the domain', async () => {
    const { handler, repo } = build();
    repo.seed(buildProduct({ id: 'p1' }));

    await expect(
      handler.execute(new UpdateAttributeCommand('p1', 'cor', 'azul')),
    ).rejects.toBeInstanceOf(AttributeKeyNotFoundError);
  });
});
