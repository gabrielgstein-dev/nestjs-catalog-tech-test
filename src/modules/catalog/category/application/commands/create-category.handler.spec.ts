import { CreateCategoryHandler } from './create-category.handler';
import { CreateCategoryCommand } from './create-category.command';
import { InMemoryCategoryRepository } from '../__test-fixtures__/in-memory-category.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { Category } from '../../domain/category';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryName } from '../../domain/value-objects/category-name';
import { CategoryCreated } from '../../domain/events/category-created.event';
import { DuplicateCategoryNameError } from '../errors/duplicate-category-name.error';
import { ParentCategoryNotFoundError } from '../errors/parent-category-not-found.error';

const build = () => {
  const repo = new InMemoryCategoryRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return { repo, publisher, handler: new CreateCategoryHandler(repo, publisher) };
};

describe('CreateCategoryHandler', () => {
  it('creates a root category and publishes CategoryCreated', async () => {
    const { handler, repo, publisher } = build();

    const result = await handler.execute(new CreateCategoryCommand('c1', 'Eletrônicos'));

    expect(result).toEqual({ id: 'c1' });
    const saved = await repo.findById(CategoryId.of('c1'));
    expect(saved).not.toBeNull();
    expect(saved?.name.value).toBe('Eletrônicos');
    expect(saved?.parentId).toBeNull();
    expect(publisher.byName(CategoryCreated.EVENT_NAME)).toHaveLength(1);
  });

  it('creates a sub-category when the parent exists', async () => {
    const { handler, repo } = build();
    repo.seed(
      Category.rehydrate({
        id: CategoryId.of('p1'),
        name: CategoryName.of('Parent'),
        parentId: null,
      }),
    );

    await handler.execute(new CreateCategoryCommand('c1', 'Child', 'p1'));

    const saved = await repo.findById(CategoryId.of('c1'));
    expect(saved?.parentId?.value).toBe('p1');
  });

  it('rejects when parent does not exist', async () => {
    const { handler } = build();

    await expect(
      handler.execute(new CreateCategoryCommand('c1', 'Child', 'missing-parent')),
    ).rejects.toBeInstanceOf(ParentCategoryNotFoundError);
  });

  it('rejects when the name is already taken', async () => {
    const { handler, repo } = build();
    repo.seed(
      Category.rehydrate({
        id: CategoryId.of('other'),
        name: CategoryName.of('Eletrônicos'),
        parentId: null,
      }),
    );

    await expect(
      handler.execute(new CreateCategoryCommand('c1', 'Eletrônicos')),
    ).rejects.toBeInstanceOf(DuplicateCategoryNameError);
  });

  it('does not publish events when creation fails (atomicity within handler)', async () => {
    const { handler, repo, publisher } = build();
    repo.seed(
      Category.rehydrate({
        id: CategoryId.of('x'),
        name: CategoryName.of('Taken'),
        parentId: null,
      }),
    );

    await expect(handler.execute(new CreateCategoryCommand('c1', 'Taken'))).rejects.toThrow();

    expect(publisher.published).toHaveLength(0);
  });
});
