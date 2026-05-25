import { AttachCategoryToProductHandler } from './attach-category-to-product.handler';
import { AttachCategoryToProductCommand } from './attach-category-to-product.command';
import { InMemoryProductRepository } from '../__test-fixtures__/in-memory-product.repository';
import { InMemoryCategoryRepository } from '../../../category/application/__test-fixtures__/in-memory-category.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { silentBusinessActionLogger } from '../../../../../shared/infra/logging/__test-fixtures__/silent-business-action-logger';
import { buildProduct } from '../__test-fixtures__/build-product';
import { Category } from '../../../category/domain/category';
import { CategoryId } from '../../../category/domain/value-objects/category-id';
import { CategoryName } from '../../../category/domain/value-objects/category-name';
import { ProductId } from '../../domain/value-objects/product-id';
import { ProductStatus } from '../../domain/value-objects/product-status';
import { CategoryAttachedToProduct } from '../../domain/events/category-attached-to-product.event';
import { ProductNotFoundError } from '../errors/product-not-found.error';
import { CategoryNotFoundError } from '../../../category/application/errors/category-not-found.error';
import { ArchivedProductIsImmutableError } from '../../domain/errors/archived-product-is-immutable.error';

const seedCategory = (repo: InMemoryCategoryRepository, id: string) => {
  repo.seed(
    Category.rehydrate({
      id: CategoryId.of(id),
      name: CategoryName.of(`cat-${id}`),
      parentId: null,
    }),
  );
};

const build = () => {
  const products = new InMemoryProductRepository();
  const categories = new InMemoryCategoryRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    products,
    categories,
    publisher,
    handler: new AttachCategoryToProductHandler(
      products,
      categories,
      publisher,
      new PassThroughUnitOfWork(),
      silentBusinessActionLogger(),
    ),
  };
};

describe('AttachCategoryToProductHandler', () => {
  it('attaches an existing category and publishes the event', async () => {
    const { handler, products, categories, publisher } = build();
    products.seed(buildProduct({ id: 'p1' }));
    seedCategory(categories, 'c1');

    await handler.execute(new AttachCategoryToProductCommand('p1', 'c1'));

    const saved = await products.findById(ProductId.of('p1'));
    expect(saved?.categoryIds.map((c) => c.value)).toEqual(['c1']);
    expect(publisher.byName(CategoryAttachedToProduct.EVENT_NAME)).toHaveLength(1);
  });

  it('throws ProductNotFoundError when the product is missing', async () => {
    const { handler } = build();

    await expect(
      handler.execute(new AttachCategoryToProductCommand('missing', 'c1')),
    ).rejects.toBeInstanceOf(ProductNotFoundError);
  });

  it('throws CategoryNotFoundError when the category does not exist', async () => {
    const { handler, products } = build();
    products.seed(buildProduct({ id: 'p1' }));

    await expect(
      handler.execute(new AttachCategoryToProductCommand('p1', 'missing-cat')),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it('propagates ArchivedProductIsImmutableError when the product is ARCHIVED', async () => {
    const { handler, products, categories } = build();
    products.seed(
      buildProduct({
        id: 'p1',
        status: ProductStatus.ARCHIVED,
        categoryIds: ['c1'],
        attributes: [['cor', 'azul']],
      }),
    );
    seedCategory(categories, 'c2');

    await expect(
      handler.execute(new AttachCategoryToProductCommand('p1', 'c2')),
    ).rejects.toBeInstanceOf(ArchivedProductIsImmutableError);
  });
});
