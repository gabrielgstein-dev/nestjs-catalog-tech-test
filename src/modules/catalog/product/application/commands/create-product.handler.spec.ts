import { CreateProductHandler } from './create-product.handler';
import { CreateProductCommand } from './create-product.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductName } from '../../domain/value-objects/product-name';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { Product } from '../../domain/product';
import { ProductDescription } from '../../domain/value-objects/product-description';
import { AttributeCollection } from '../../domain/value-objects/attribute-collection';
import { ProductCreated } from '../../domain/events/product-created.event';

const build = () => {
  const repo = new InMemoryProductRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    repo,
    publisher,
    handler: new CreateProductHandler(repo, publisher, new PassThroughUnitOfWork()),
  };
};

describe('CreateProductHandler', () => {
  it('creates a DRAFT product and publishes ProductCreated', async () => {
    const { handler, repo, publisher } = build();

    const result = await handler.execute(new CreateProductCommand('p1', 'Cadeira', 'Premium'));

    expect(result).toEqual({ id: 'p1' });
    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.status).toBe(ProductStatus.DRAFT);
    expect(saved?.name.value).toBe('Cadeira');
    expect(saved?.description.value).toBe('Premium');
    expect(publisher.byName(ProductCreated.EVENT_NAME)).toHaveLength(1);
  });

  it('allows TWO DRAFT products with the same name to coexist (uniqueness is only at activation)', async () => {
    const { handler, repo } = build();
    repo.seed(
      Product.rehydrate({
        id: ProductId.of('existing'),
        name: ProductName.of('Cadeira'),
        description: ProductDescription.of(null),
        status: ProductStatus.DRAFT,
        categoryIds: [],
        attributes: AttributeCollection.empty(),
      }),
    );

    await expect(handler.execute(new CreateProductCommand('p1', 'Cadeira'))).resolves.toEqual({
      id: 'p1',
    });
    expect(repo.size()).toBe(2);
  });

  it('persists description = null when not provided', async () => {
    const { handler, repo } = build();

    await handler.execute(new CreateProductCommand('p1', 'Cadeira'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.description.value).toBeNull();
  });
});
