import { ActivateProductHandler } from './activate-product.handler';
import { ActivateProductCommand } from './activate-product.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { buildProduct } from '../__test-fixtures__/build-product';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { ProductActivated } from '../../domain/events/product-activated.event';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { ProductCannotBeActivatedError } from '../../domain/errors/product-cannot-be-activated.error';

const build = () => {
  const repo = new InMemoryProductRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return { repo, publisher, handler: new ActivateProductHandler(repo, publisher) };
};

const buildReady = (id: string, name = 'Cadeira') =>
  buildProduct({ id, name, categoryIds: ['c1'], attributes: [['cor', 'azul']] });

describe('ActivateProductHandler', () => {
  it('activates a DRAFT product with categories and attributes (no name conflict)', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(buildReady('p1'));

    await handler.execute(new ActivateProductCommand('p1'));

    const saved = await repo.findById(ProductId.of('p1'));
    expect(saved?.status).toBe(ProductStatus.ACTIVE);
    expect(publisher.byName(ProductActivated.EVENT_NAME)).toHaveLength(1);
  });

  it('throws ProductNotFoundError when missing', async () => {
    const { handler } = build();
    await expect(handler.execute(new ActivateProductCommand('missing'))).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
  });

  describe('name uniqueness gate (the principal business rule)', () => {
    it('blocks activation when another non-archived product has the same name', async () => {
      const { handler, repo, publisher } = build();
      repo.seed(buildReady('p1', 'Cadeira'));
      repo.seed(
        buildProduct({
          id: 'other',
          name: 'Cadeira',
          status: ProductStatus.ACTIVE,
          categoryIds: ['c1'],
          attributes: [['cor', 'verde']],
        }),
      );

      try {
        await handler.execute(new ActivateProductCommand('p1'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProductCannotBeActivatedError);
        expect((err as ProductCannotBeActivatedError).reason).toBe('name_taken');
      }

      const saved = await repo.findById(ProductId.of('p1'));
      expect(saved?.status).toBe(ProductStatus.DRAFT);
      expect(publisher.published).toHaveLength(0);
    });

    it('blocks activation when another DRAFT product has the same name', async () => {
      const { handler, repo } = build();
      repo.seed(buildReady('p1', 'Cadeira'));
      repo.seed(buildProduct({ id: 'other', name: 'Cadeira' }));

      await expect(handler.execute(new ActivateProductCommand('p1'))).rejects.toBeInstanceOf(
        ProductCannotBeActivatedError,
      );
    });

    it('ALLOWS activation when the only same-named product is ARCHIVED (archived releases the name)', async () => {
      const { handler, repo } = build();
      repo.seed(buildReady('p1', 'Cadeira'));
      repo.seed(
        buildProduct({
          id: 'old',
          name: 'Cadeira',
          status: ProductStatus.ARCHIVED,
          categoryIds: ['c1'],
          attributes: [['cor', 'azul']],
        }),
      );

      await expect(handler.execute(new ActivateProductCommand('p1'))).resolves.toBeUndefined();
    });

    it('excludes self from the check (idempotent reactivation not possible, but logic must not self-conflict)', async () => {
      const { handler, repo } = build();
      repo.seed(buildReady('p1', 'Cadeira'));

      await expect(handler.execute(new ActivateProductCommand('p1'))).resolves.toBeUndefined();
    });
  });

  describe('domain invariant propagation', () => {
    it('propagates missing_categories from the domain', async () => {
      const { handler, repo } = build();
      repo.seed(buildProduct({ id: 'p1', attributes: [['cor', 'azul']] }));

      try {
        await handler.execute(new ActivateProductCommand('p1'));
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ProductCannotBeActivatedError);
        expect((err as ProductCannotBeActivatedError).reason).toBe('missing_categories');
      }
    });

    it('propagates missing_attributes from the domain', async () => {
      const { handler, repo } = build();
      repo.seed(buildProduct({ id: 'p1', categoryIds: ['c1'] }));

      try {
        await handler.execute(new ActivateProductCommand('p1'));
        fail('should have thrown');
      } catch (err) {
        expect((err as ProductCannotBeActivatedError).reason).toBe('missing_attributes');
      }
    });

    it('propagates already_active from the domain', async () => {
      const { handler, repo } = build();
      repo.seed(
        buildProduct({
          id: 'p1',
          status: ProductStatus.ACTIVE,
          categoryIds: ['c1'],
          attributes: [['cor', 'azul']],
        }),
      );

      try {
        await handler.execute(new ActivateProductCommand('p1'));
        fail('should have thrown');
      } catch (err) {
        expect((err as ProductCannotBeActivatedError).reason).toBe('already_active');
      }
    });

    it('propagates archived from the domain', async () => {
      const { handler, repo } = build();
      repo.seed(
        buildProduct({
          id: 'p1',
          status: ProductStatus.ARCHIVED,
          categoryIds: ['c1'],
          attributes: [['cor', 'azul']],
        }),
      );

      try {
        await handler.execute(new ActivateProductCommand('p1'));
        fail('should have thrown');
      } catch (err) {
        expect((err as ProductCannotBeActivatedError).reason).toBe('archived');
      }
    });
  });
});
