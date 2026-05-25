import { ChangeCategoryParentHandler } from './change-category-parent.handler';
import { ChangeCategoryParentCommand } from './change-category-parent.command';
import { InMemoryCategoryRepository } from '../__test-fixtures__/in-memory-category.repository';
import { InMemoryDomainEventPublisher } from '../../../../../shared/application/__test-fixtures__/in-memory-domain-event-publisher';
import { PassThroughUnitOfWork } from '../../../../../shared/application/__test-fixtures__/pass-through-unit-of-work';
import { Category } from '../../domain/category';
import { CategoryId } from '../../domain/value-objects/category-id';
import { CategoryName } from '../../domain/value-objects/category-name';
import { CategoryUpdated } from '../../domain/events/category-updated.event';
import { CategoryNotFoundError } from '../errors/category-not-found.error';
import { ParentCategoryNotFoundError } from '../errors/parent-category-not-found.error';
import { CategoryCannotBeOwnParentError } from '../../domain/errors/category-cannot-be-own-parent.error';

const seedCategory = (
  repo: InMemoryCategoryRepository,
  id: string,
  parentId: string | null = null,
) => {
  repo.seed(
    Category.rehydrate({
      id: CategoryId.of(id),
      name: CategoryName.of(`name-${id}`),
      parentId: parentId ? CategoryId.of(parentId) : null,
    }),
  );
};

const build = () => {
  const repo = new InMemoryCategoryRepository();
  const publisher = new InMemoryDomainEventPublisher();
  return {
    repo,
    publisher,
    handler: new ChangeCategoryParentHandler(repo, publisher, new PassThroughUnitOfWork()),
  };
};

describe('ChangeCategoryParentHandler', () => {
  it('attaches a new parent and publishes CategoryUpdated', async () => {
    const { handler, repo, publisher } = build();
    seedCategory(repo, 'c1');
    seedCategory(repo, 'p1');

    await handler.execute(new ChangeCategoryParentCommand('c1', 'p1'));

    const saved = await repo.findById(CategoryId.of('c1'));
    expect(saved?.parentId?.value).toBe('p1');
    expect(publisher.byName(CategoryUpdated.EVENT_NAME)).toHaveLength(1);
  });

  it('detaches the parent (null) and publishes CategoryUpdated', async () => {
    const { handler, repo, publisher } = build();
    seedCategory(repo, 'p1');
    seedCategory(repo, 'c1', 'p1');

    await handler.execute(new ChangeCategoryParentCommand('c1', null));

    const saved = await repo.findById(CategoryId.of('c1'));
    expect(saved?.parentId).toBeNull();
    expect(publisher.byName(CategoryUpdated.EVENT_NAME)).toHaveLength(1);
  });

  it('throws CategoryNotFoundError when the category does not exist', async () => {
    const { handler } = build();

    await expect(
      handler.execute(new ChangeCategoryParentCommand('missing', null)),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
  });

  it('throws ParentCategoryNotFoundError when the new parent does not exist', async () => {
    const { handler, repo } = build();
    seedCategory(repo, 'c1');

    await expect(
      handler.execute(new ChangeCategoryParentCommand('c1', 'missing-parent')),
    ).rejects.toBeInstanceOf(ParentCategoryNotFoundError);
  });

  it('propagates CategoryCannotBeOwnParentError from the domain', async () => {
    const { handler, repo } = build();
    seedCategory(repo, 'c1');

    await expect(
      handler.execute(new ChangeCategoryParentCommand('c1', 'c1')),
    ).rejects.toBeInstanceOf(CategoryCannotBeOwnParentError);
  });

  it('does not publish events when the gate fails', async () => {
    const { handler, repo, publisher } = build();
    seedCategory(repo, 'c1');

    await expect(
      handler.execute(new ChangeCategoryParentCommand('c1', 'missing')),
    ).rejects.toThrow();
    expect(publisher.published).toHaveLength(0);
  });
});
